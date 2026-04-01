import Papa from "papaparse";

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
}

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

function parseBRNumber(value: string): number {
  if (!value || value.trim() === "" || value === "-") return 0;
  const trimmed = value.trim();
  const isNegative = trimmed.startsWith("-");
  // Remove R$, negative sign, spaces, dots as thousand separators, replace comma with dot
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

function parseBRDate(value: string): Date | null {
  if (!value) return null;
  const parts = value.trim().split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
  }
  return null;
}

export async function fetchSheetTabs(sheetId: string): Promise<SheetTab[]> {
  const cacheKey = `tabs_${sheetId}`;
  const cached = getCached<SheetTab[]>(cacheKey);
  if (cached) return cached;

  // Fetch the spreadsheet HTML page to extract sheet names and GIDs
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Planilha não encontrada ou não é pública. Compartilhe como Viewer.");
    }
    const html = await response.text();

    // Parse sheet info from the HTML - Google embeds it in the page
    const tabs: SheetTab[] = [];
    
    // Method 1: Look for sheet info in the HTML meta/script data
    // Google Sheets embeds sheet data in various formats
    const gidRegex = /gid=(\d+).*?>(.*?)<\/a>/g;
    let match;
    while ((match = gidRegex.exec(html)) !== null) {
      tabs.push({ gid: match[1], name: match[2].trim() });
    }

    // Method 2: Parse from the sheet tab buttons
    if (tabs.length === 0) {
      const tabRegex = /sheet-button[^>]*data-id="(\d+)"[^>]*>.*?<span[^>]*>(.*?)<\/span>/gs;
      while ((match = tabRegex.exec(html)) !== null) {
        tabs.push({ gid: match[1], name: match[2].trim() });
      }
    }

    // Method 3: Try to find in JSON-like structures
    if (tabs.length === 0) {
      const jsonRegex = /"sheetId"\s*:\s*(\d+)\s*,\s*"title"\s*:\s*"([^"]+)"/g;
      while ((match = jsonRegex.exec(html)) !== null) {
        tabs.push({ gid: match[1], name: match[2].trim() });
      }
    }

    // Method 4: Brute force - try common month names
    if (tabs.length === 0) {
      const months = [
        "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
        "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
      ];
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const years = [currentYear, String(Number(currentYear) - 1), String(Number(currentYear) + 1)];
      
      // Try first sheet (gid=0)
      const testUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=0`;
      try {
        const testRes = await fetch(testUrl);
        if (testRes.ok) {
          tabs.push({ gid: "0", name: "Planilha1" });
        }
      } catch {}

      // Try to discover tabs by attempting fetches with sheet names
      for (const year of years) {
        for (const month of months) {
          const tabName = `${month} ${year}`;
          const tabUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
          try {
            const res = await fetch(tabUrl, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
              const text = await res.text();
              if (text.length > 50) {
                tabs.push({ gid: "", name: tabName });
              }
            }
          } catch {}
        }
      }
    }

    if (tabs.length === 0) {
      // Fallback: at least try gid=0
      tabs.push({ gid: "0", name: "Principal" });
    }

    setCache(cacheKey, tabs);
    return tabs;
  } catch (error) {
    console.error("Erro ao buscar abas:", error);
    throw new Error("Não foi possível acessar a planilha. Verifique se o ID está correto e a planilha é pública.");
  }
}

export async function fetchSheetData(sheetId: string, tab: SheetTab): Promise<SalesRow[]> {
  const cacheKey = `data_${sheetId}_${tab.name}`;
  const cached = getCached<SalesRow[]>(cacheKey);
  if (cached) return cached;

  // Try by sheet name first (more reliable), fallback to gid
  let url: string;
  if (tab.name && tab.name !== "Principal") {
    url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab.name)}`;
  } else {
    url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${tab.gid}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao buscar dados da aba "${tab.name}"`);
    }
    const csvText = await response.text();
    
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    const rows: SalesRow[] = [];
    const headers = parsed.meta.fields || [];
    
    // Find columns by partial match (headers may have extra text)
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

    rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    setCache(cacheKey, rows);
    return rows;
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    throw error;
  }
}

export function calculateSummary(rows: SalesRow[]): SalesSummary {
  if (rows.length === 0) {
    return {
      totalTickets: 0,
      totalGrossRevenue: 0,
      totalFees: 0,
      totalGrossResult: 0,
      totalInvestment: 0,
      totalRealProfit: 0,
      avgRoas: 0,
      avgTicket: 0,
      daysCount: 0,
    };
  }

  const totalTickets = rows.reduce((sum, r) => sum + r.tickets, 0);
  const totalGrossRevenue = rows.reduce((sum, r) => sum + r.grossRevenue, 0);
  const totalFees = rows.reduce((sum, r) => sum + r.fees, 0);
  const totalGrossResult = rows.reduce((sum, r) => sum + r.grossResult, 0);
  const totalInvestment = rows.reduce((sum, r) => sum + r.investment, 0);
  const totalRealProfit = rows.reduce((sum, r) => sum + r.realProfit, 0);
  const avgRoas = rows.reduce((sum, r) => sum + r.roas, 0) / rows.length;
  const avgTicket = rows.reduce((sum, r) => sum + r.avgTicket, 0) / rows.length;

  return {
    totalTickets,
    totalGrossRevenue,
    totalFees,
    totalGrossResult,
    totalInvestment,
    totalRealProfit,
    avgRoas,
    avgTicket,
    daysCount: rows.length,
  };
}

export function filterByDateRange(rows: SalesRow[], start: Date, end: Date): SalesRow[] {
  return rows.filter((r) => r.dateObj >= start && r.dateObj <= end);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
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
