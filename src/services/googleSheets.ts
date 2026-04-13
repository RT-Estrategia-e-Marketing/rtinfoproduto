import Papa from "papaparse";
import { getLocalDateKey } from "./dateUtils";

export interface SalesRow {
  date: string;
  dateObj: Date;
  dayOfWeek: string;
  tickets: number;
  grossRevenue: number;
  fees: number;
  grossResult: number;
  investment: number;
  realProfit: number;
  roas: number;
  avgTicket: number;
  refundedTickets: number;
  refundedValue: number;
}

export interface SheetTab {
  name: string;
  gid: string;
}

export interface SalesSummary {
  totalTickets: number;
  totalGrossRevenue: number;
  totalFees: number;
  totalGrossResult: number;
  totalInvestment: number;
  totalRealProfit: number;
  avgRoas: number;
  avgTicket: number;
  daysCount: number;
  totalRefundedTickets: number;
  totalRefundedValue: number;
}

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function parseBRNumber(value: string): number {
  if (!value || value.trim() === "" || value === "-") return 0;
  const trimmed = value.trim();
  const isNegative = trimmed.startsWith("-");
  const cleaned = trimmed
    .replace(/-/g, "")
    .replace(/R\$\s*/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

export function parseBRDate(value: string): Date | null {
  if (!value) return null;
  const parts = value.trim().split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
  }
  return null;
}

/** Fetch only investment data from monthly tabs (lightweight: select A,G) */
export async function fetchInvestmentData(sheetId: string): Promise<Map<string, number>> {
  const cacheKey = `invest_${sheetId}`;
  const cached = getCached<Map<string, number>>(cacheKey);
  if (cached) return cached;

  const monthNames = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];
  const currentYear = new Date().getFullYear();
  const yearsToTry = [currentYear - 1, currentYear, currentYear + 1].map((y) => String(y).slice(-2));

  const investMap = new Map<string, number>();
  const tabNames: string[] = [];
  for (const year of yearsToTry) {
    for (const month of monthNames) {
      tabNames.push(`${month} ${year}`);
    }
  }

  for (let i = 0; i < tabNames.length; i += 6) {
    const batch = tabNames.slice(i, i + 6);
    await Promise.allSettled(
      batch.map(async (tabName) => {
        const query = encodeURIComponent("select A,G");
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&tq=${query}`;
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!res.ok) return;
          const csv = await res.text();
          if (csv.length < 30 || csv.includes("Could not parse query")) return;
          const parsed = Papa.parse<string[]>(csv, { header: false, skipEmptyLines: true });
          const rows = parsed.data;
          for (let j = 1; j < rows.length; j++) {
            const dateStr = (rows[j][0] || "").replace(/^"|"$/g, "").trim();
            const investStr = (rows[j][1] || "").replace(/^"|"$/g, "").trim();
            const dateObj = parseBRDate(dateStr);
            if (dateObj && !isNaN(dateObj.getTime())) {
              const key = getLocalDateKey(dateObj);
              const inv = parseBRNumber(investStr);
              if (inv !== 0) investMap.set(key, inv);
            }
          }
        } catch {}
      })
    );
  }

  setCache(cacheKey, investMap);
  return investMap;
}

export function clearDataCache() {
  cache.clear();
}

export async function fetchSheetTabs(sheetId: string): Promise<SheetTab[]> {
  const cacheKey = `tabs_${sheetId}`;
  const cached = getCached<SheetTab[]>(cacheKey);
  if (cached) return cached;

  const months = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];

  const currentYear = new Date().getFullYear();
  const yearsToTry = [currentYear - 1, currentYear, currentYear + 1]
    .map((y) => String(y).slice(-2));

  const tabs: SheetTab[] = [];

  const probes: { name: string; url: string }[] = [];
  for (const year of yearsToTry) {
    for (const month of months) {
      const name = `${month} ${year}`;
      probes.push({
        name,
        url: `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`,
      });
    }
  }

  for (let i = 0; i < probes.length; i += 6) {
    const batch = probes.slice(i, i + 6);
    const results = await Promise.allSettled(
      batch.map(async (p) => {
        const res = await fetch(p.url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const text = await res.text();
          if (text.length > 50 && !text.includes("Could not parse query")) {
            return p.name;
          }
        }
        return null;
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        tabs.push({ gid: "", name: r.value });
      }
    }
  }

  const monthOrder = Object.fromEntries(months.map((m, i) => [m, i]));
  tabs.sort((a, b) => {
    const [mA, yA] = a.name.split(" ");
    const [mB, yB] = b.name.split(" ");
    if (yA !== yB) return parseInt(yA) - parseInt(yB);
    return (monthOrder[mA] ?? 0) - (monthOrder[mB] ?? 0);
  });

  if (tabs.length === 0) {
    throw new Error("Nenhuma aba encontrada no formato 'MÊS ANO'. Verifique se a planilha é pública.");
  }

  setCache(cacheKey, tabs);
  return tabs;
}

function parseSheetRows(csvText: string): SalesRow[] {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  const rows: SalesRow[] = [];
  const headers = parsed.meta.fields || [];

  function findCol(partials: string[]): string {
    for (const p of partials) {
      const found = headers.find((h) => h.toLowerCase().trim().includes(p.toLowerCase()));
      if (found) return found;
    }
    return "";
  }

  const colDate = findCol(["Data"]);
  const colDay = findCol(["Dia Semana", "Dia da Semana"]);
  const colTickets = findCol(["TICKETS", "Tickets"]);
  const colRevenue = findCol(["Faturamento Bruto"]);
  const colFees = findCol(["Taxas"]);
  const colGrossResult = findCol(["Resultado Bruto"]);
  const colInvestment = findCol(["Investimento"]);
  const colProfit = findCol(["Lucro Real"]);
  const colRoas = findCol(["ROAS"]);
  const colAvgTicket = findCol(["Ticket Médio", "Ticket Medio"]);

  for (const row of parsed.data as Record<string, string>[]) {
    const dateStr = row[colDate] || "";
    const dateObj = parseBRDate(dateStr);
    if (!dateObj) continue;

    rows.push({
      date: dateStr.trim(),
      dateObj,
      dayOfWeek: (row[colDay] || "").trim(),
      tickets: parseBRNumber(row[colTickets] || "0"),
      grossRevenue: parseBRNumber(row[colRevenue] || "0"),
      fees: parseBRNumber(row[colFees] || "0"),
      grossResult: parseBRNumber(row[colGrossResult] || "0"),
      investment: parseBRNumber(row[colInvestment] || "0"),
      realProfit: parseBRNumber(row[colProfit] || "0"),
      roas: parseBRNumber(row[colRoas] || "0"),
      avgTicket: parseBRNumber(row[colAvgTicket] || "0"),
    });
  }

  return rows;
}

export async function fetchSheetData(sheetId: string, tab: SheetTab): Promise<SalesRow[]> {
  const cacheKey = `data_${sheetId}_${tab.name}`;
  const cached = getCached<SalesRow[]>(cacheKey);
  if (cached) return cached;

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab.name)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao buscar dados da aba "${tab.name}"`);
  }
  const csvText = await response.text();
  const rows = parseSheetRows(csvText);
  rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  setCache(cacheKey, rows);
  return rows;
}

/** Fetch ALL tabs data and merge into a single array */
export async function fetchAllTabsData(sheetId: string, tabs: SheetTab[]): Promise<SalesRow[]> {
  const cacheKey = `alldata_${sheetId}`;
  const cached = getCached<SalesRow[]>(cacheKey);
  if (cached) return cached;

  const allRows: SalesRow[] = [];

  // Fetch all tabs in parallel batches of 4
  for (let i = 0; i < tabs.length; i += 4) {
    const batch = tabs.slice(i, i + 4);
    const results = await Promise.allSettled(
      batch.map(async (tab) => {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab.name)}`;
        const response = await fetch(url);
        if (!response.ok) return [];
        const csvText = await response.text();
        return parseSheetRows(csvText);
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        allRows.push(...r.value);
      }
    }
  }

  // Deduplicate by date string to avoid duplicate entries from tabs with same data
  const seen = new Map<string, SalesRow>();
  for (const row of allRows) {
    const key = row.date;
    if (!seen.has(key)) {
      seen.set(key, row);
    }
  }
  const uniqueRows = Array.from(seen.values());
  uniqueRows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  setCache(cacheKey, uniqueRows);
  return uniqueRows;
}

export function calculateSummary(rows: SalesRow[]): SalesSummary {
  if (rows.length === 0) {
    return {
      totalTickets: 0, totalGrossRevenue: 0, totalFees: 0, totalGrossResult: 0,
      totalInvestment: 0, totalRealProfit: 0, avgRoas: 0, avgTicket: 0, daysCount: 0,
      totalRefundedTickets: 0, totalRefundedValue: 0,
    };
  }

  const totalTickets = rows.reduce((sum, r) => sum + r.tickets, 0);
  const totalGrossRevenue = rows.reduce((sum, r) => sum + r.grossRevenue, 0);
  const totalFees = rows.reduce((sum, r) => sum + r.fees, 0);
  const totalGrossResult = rows.reduce((sum, r) => sum + r.grossResult, 0);
  const totalInvestment = rows.reduce((sum, r) => sum + r.investment, 0);
  const totalRealProfit = rows.reduce((sum, r) => sum + r.realProfit, 0);
  const avgRoas = totalInvestment > 0 ? totalRealProfit / totalInvestment : 0;
  const avgTicket = totalTickets > 0 ? totalGrossRevenue / totalTickets : 0;
  const totalRefundedTickets = rows.reduce((sum, r) => sum + r.refundedTickets, 0);
  const totalRefundedValue = rows.reduce((sum, r) => sum + r.refundedValue, 0);

  return {
    totalTickets, totalGrossRevenue, totalFees, totalGrossResult,
    totalInvestment, totalRealProfit, avgRoas, avgTicket, daysCount: rows.length,
    totalRefundedTickets, totalRefundedValue,
  };
}

export function filterByDateRange(rows: SalesRow[], start: Date, end: Date): SalesRow[] {
  return rows.filter((r) => r.dateObj >= start && r.dateObj <= end);
}

export function getAvailableMonths(rows: SalesRow[]): { label: string; year: number; month: number }[] {
  const monthSet = new Map<string, { year: number; month: number }>();
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  for (const row of rows) {
    const key = `${row.dateObj.getFullYear()}-${row.dateObj.getMonth()}`;
    if (!monthSet.has(key)) {
      monthSet.set(key, { year: row.dateObj.getFullYear(), month: row.dateObj.getMonth() });
    }
  }
  const months = Array.from(monthSet.values());
  months.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  return months.map((m) => ({
    label: `${monthNames[m.month]} ${m.year}`,
    year: m.year,
    month: m.month,
  }));
}

export function filterByMonth(rows: SalesRow[], year: number, month: number): SalesRow[] {
  return rows.filter((r) => r.dateObj.getFullYear() === year && r.dateObj.getMonth() === month);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

export function exportToCSV(rows: SalesRow[], filename: string) {
  const headers = ["Data", "Dia da Semana", "TICKETS", "Faturamento Bruto", "Taxas", "Resultado Bruto", "Investimento", "Lucro Real", "ROAS", "Ticket Médio"];
  const csvRows = [
    headers.join(","),
    ...rows.map((r) =>
      [r.date, r.dayOfWeek, r.tickets, r.grossRevenue, r.fees, r.grossResult, r.investment, r.realProfit, r.roas, r.avgTicket].join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
