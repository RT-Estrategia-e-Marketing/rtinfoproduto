import Papa from "papaparse";
import { parseBRDate, parseBRNumber } from "./googleSheets";
import { getLocalDateKey } from "./dateUtils";

// Minimum date filter: only process rows on/after 07/08/2025
const TRAFFIC_MIN_DATE = new Date(2025, 7, 7); // August 7, 2025

export interface TrafficRow {
  date: string;
  dateObj: Date;
  investimentoAnuncios: number;       // Coluna E
  investimentoComImposto: number;     // Coluna F
  impostoMetaAds: number;             // Calculado: ColF - ColE
  metrics: Record<string, number>;    // Colunas N–X com nome real como chave
}

export interface TrafficSummary {
  totalImpostoMetaAds: number;
  totalInvestimentoAnuncios: number;
  totalInvestimentoComImposto: number;
  metricTotals: Record<string, number>;
  metricAverages: Record<string, number>;
  metricHeaders: string[];
  daysCount: number;
}

// Local cache (shared TTL pattern with googleSheets.ts)
const trafficCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = trafficCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  trafficCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  trafficCache.set(key, { data, timestamp: Date.now() });
}

export function clearTrafficCache() {
  trafficCache.clear();
}

/**
 * Fetch and parse the "Planilha Base" tab.
 *
 * CSV structure:
 *   Row 1 (index 0): Ignored (title row or merged header)
 *   Row 2 (index 1): Column headers — used to name metrics N–X dynamically
 *   Row 3+ (index 2+): Data rows
 *
 * Column indices (0-based):
 *   D = 3  → Date
 *   E = 4  → Investimento em Anúncios
 *   F = 5  → Investimento + Imposto Meta Ads
 *   N = 13 … X = 23 → Traffic metrics (dynamic)
 */
export async function fetchTrafficData(sheetId: string): Promise<TrafficRow[]> {
  const cacheKey = `traffic_${sheetId}`;
  const cached = getCached<TrafficRow[]>(cacheKey);
  if (cached) return cached;

  const sheetName = "Planilha Base";
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`Erro ao buscar aba "${sheetName}" (HTTP ${response.status})`);
  }
  const csvText = await response.text();

  if (csvText.length < 50 || csvText.toLowerCase().includes("could not parse query")) {
    throw new Error(`Aba "${sheetName}" não encontrada ou planilha não é pública.`);
  }

  // Parse raw: no header mode — we handle rows manually
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  const rawRows = parsed.data;

  if (rawRows.length < 2) {
    return [];
  }

  // Find the header row dynamically: gviz might skip empty top rows, so the header row 
  // (which is Line 2 in the sheet) could be at index 0 or 1.
  // We look for a row where Column D (index 3) is "Data" or similar.
  let headerRowIndex = 0; // fallback
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const colD = (rawRows[i][3] || "").replace(/^"|"$/g, "").toLowerCase().trim();
    if (colD === "data") {
      headerRowIndex = i;
      break;
    }
  }

  const headerRow = rawRows[headerRowIndex].map((h) => h.replace(/^"|"$/g, "").trim());

  // Extract metric headers from columns N–X (indices 13–23)
  const METRIC_START = 13; // column N
  const METRIC_END = 23;   // column X (inclusive)
  const metricHeaders: string[] = [];
  for (let i = METRIC_START; i <= METRIC_END; i++) {
    const name = headerRow[i] || `Métrica ${i - METRIC_START + 1}`;
    metricHeaders.push(name);
  }

  const rows: TrafficRow[] = [];

  // Data rows start immediately after the header row
  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const raw = rawRows[i].map((c) => c.replace(/^"|"$/g, "").trim());

    const dateStr = raw[3] || ""; // Column D
    const dateObj = parseBRDate(dateStr);
    if (!dateObj || isNaN(dateObj.getTime())) continue;

    // Apply minimum date filter
    if (dateObj < TRAFFIC_MIN_DATE) continue;

    const investimentoAnuncios = parseBRNumber(raw[4] || "0");     // Column E
    const investimentoComImposto = parseBRNumber(raw[5] || "0");   // Column F
    const impostoMetaAds = investimentoComImposto - investimentoAnuncios;

    const metrics: Record<string, number> = {};
    for (let m = 0; m < metricHeaders.length; m++) {
      const colIndex = METRIC_START + m;
      metrics[metricHeaders[m]] = parseBRNumber(raw[colIndex] || "0");
    }

    rows.push({
      date: dateStr,
      dateObj,
      investimentoAnuncios,
      investimentoComImposto,
      impostoMetaAds,
      metrics,
    });
  }

  rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  setCache(cacheKey, rows);
  return rows;
}

export function filterTrafficByDateRange(
  rows: TrafficRow[],
  start: Date,
  end: Date
): TrafficRow[] {
  return rows.filter((r) => r.dateObj >= start && r.dateObj <= end);
}

export function filterTrafficByMonth(
  rows: TrafficRow[],
  year: number,
  month: number
): TrafficRow[] {
  return rows.filter(
    (r) => r.dateObj.getFullYear() === year && r.dateObj.getMonth() === month
  );
}

export function getTrafficMetricHeaders(rows: TrafficRow[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0].metrics);
}

export function calculateTrafficSummary(rows: TrafficRow[]): TrafficSummary {
  const metricHeaders = getTrafficMetricHeaders(rows);

  if (rows.length === 0) {
    return {
      totalImpostoMetaAds: 0,
      totalInvestimentoAnuncios: 0,
      totalInvestimentoComImposto: 0,
      metricTotals: {},
      metricAverages: {},
      metricHeaders,
      daysCount: 0,
    };
  }

  const totalImpostoMetaAds = rows.reduce((s, r) => s + r.impostoMetaAds, 0);
  const totalInvestimentoAnuncios = rows.reduce((s, r) => s + r.investimentoAnuncios, 0);
  const totalInvestimentoComImposto = rows.reduce((s, r) => s + r.investimentoComImposto, 0);

  const metricTotals: Record<string, number> = {};
  const metricAverages: Record<string, number> = {};

  for (const header of metricHeaders) {
    const total = rows.reduce((s, r) => s + (r.metrics[header] ?? 0), 0);
    metricTotals[header] = total;
    metricAverages[header] = rows.length > 0 ? total / rows.length : 0;
  }

  return {
    totalImpostoMetaAds,
    totalInvestimentoAnuncios,
    totalInvestimentoComImposto,
    metricTotals,
    metricAverages,
    metricHeaders,
    daysCount: rows.length,
  };
}
