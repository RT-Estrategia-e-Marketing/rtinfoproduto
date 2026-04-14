import Papa from "papaparse";
import { parseBRNumber } from "./googleSheets";
import type { WebhookSale } from "./webhookParser";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function classifyProduct(name: string): "principal" | "upsell" | "orderbump" {
  const lower = name.toLowerCase();
  if (lower.includes("pizza na prática") || lower.includes("pizza na pratica")) return "principal";
  if (lower.includes("bases gourmet") || lower.includes("bases gourmets") || lower.includes("pizza lucrativa")) return "upsell";
  return "orderbump";
}

function parseDateTime(value: string): Date | null {
  if (!value) return null;
  const t = value.trim();

  // Formato ISO-like (ex: 2026-02-15T02:23:45.000Z) convertido forçadamente para Local Time
  const isoMatch = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoMatch) {
    return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3], +isoMatch[4], +isoMatch[5], +(isoMatch[6] || 0));
  }

  // YYYY-MM-DD com ou sem hora
  const match = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    return new Date(+match[1], +match[2] - 1, +match[3], +(match[4] || 0), +(match[5] || 0), +(match[6] || 0));
  }
  
  // DD/MM/YYYY com ou sem hora
  const match2 = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match2) {
    return new Date(+match2[3], +match2[2] - 1, +match2[1], +(match2[4] || 0), +(match2[5] || 0), +(match2[6] || 0));
  }
  
  return null;
}

function mapStatus(status: string): string {
  const s = status.toLowerCase().trim();
  if (s.includes("aprovad") || s === "aprovada" || s === "approved") return "PURCHASE_APPROVED";
  if (s.includes("reembols") || s === "refunded" || s.includes("chargeback") || s.includes("contest")) return "PURCHASE_REFUNDED";
  if (s.includes("saque") || s.includes("tarifa") || s.includes("ajuste") || s.includes("taxa")) return "SYSTEM_FEE";
  return status;
}

export function parseOldDataRows(csvText: string): WebhookSale[] {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const headers = parsed.meta.fields || [];
  const findCol = (partials: string[]): string => {
    for (const p of partials) {
      const normalized = p.toLowerCase().trim();
      const exact = headers.find((h) => h.toLowerCase().trim() === normalized);
      if (exact) return exact;
      const partial = headers.find((h) => h.toLowerCase().trim().includes(normalized));
      if (partial) return partial;
    }
    return "";
  };

  const colStatus = findCol(["Status"]);
  const colProductId = findCol(["CodProduto", "Cod_Produto", "cod_produto"]);
  const colProductName = findCol(["Produto"]);
  const colPayment = findCol(["Metodo_de_Pagamento", "MetodoPagamento"]);
  const colBuyer = findCol(["Comprador"]);
  const colEmail = findCol(["Email"]);
  const colValorLiquido = findCol(["Valor_Liquido", "ValorLiquido"]);
  const colPrecoBase = findCol(["Preco_Base_do_Produto", "PrecoBase", "Valor_Bruto", "ValorBruto"]);
  const colSck = findCol(["Sck", "src"]);
  const colUtmCampaign = findCol(["UtmCampaign"]);
  const colUtmMedium = findCol(["UtmMedium"]);
  const colUtmSource = findCol(["UtmSource"]);
  const colUtmContent = findCol(["UtmContent"]);
  // A prioridade da Data é essencialmente a APROVAÇÃO, pois boletos gerados e não pagos não contam p/ o dia financeiro.
  const colDate = findCol(["Data de Aprovação", "Data de Aprovacao", "Data Aprovação", "Data Confirmação", "Data Confirmacao", "Aprovacao", "Aprovação", "Data de Venda", "Data", "Criado"]);

  const rows: WebhookSale[] = [];

  for (const row of parsed.data as Record<string, string>[]) {
    const status = (row[colStatus] || "").trim();
    if (!status) continue;

    const event = mapStatus(status);
    if (!event.includes("APPROVED") && !event.includes("REFUNDED") && event !== "SYSTEM_FEE") continue;

    const dateObj = parseDateTime(row[colDate] || "");
    if (!dateObj || isNaN(dateObj.getTime())) continue;

    const productId = (row[colProductId] || "").trim();
    const productName = (row[colProductName] || "").trim();
    if (!productName && !productId) continue;

    const originalPrice = parseBRNumber(row[colPrecoBase] || "0");
    const commissionReceived = parseBRNumber(row[colValorLiquido] || "0");
    const platformFee = Math.abs(originalPrice) - Math.abs(commissionReceived);

    rows.push({
      date: row[colDate] || "",
      dateObj,
      hour: dateObj.getHours(),
      dayOfWeek: dateObj.getDay(),
      dayOfWeekLabel: DAY_LABELS[dateObj.getDay()],
      event,
      productId,
      productName: productName || `Produto ${productId}`,
      buyerName: (row[colBuyer] || "").trim(),
      originalPrice,
      commissionReceived,
      platformFee: Math.max(0, platformFee),
      paymentType: (row[colPayment] || "").trim(),
      originSck: (row[colSck] || "").trim(),
      utmCampaign: (row[colUtmCampaign] || "").trim(),
      utmMedium: (row[colUtmMedium] || "").trim(),
      utmSource: (row[colUtmSource] || "").trim(),
      utmContent: (row[colUtmContent] || "").trim(),
      productCategory: classifyProduct(productName),
      source: "old",
    });
  }

  rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  return rows;
}

export async function fetchOldData(sheetId: string): Promise<WebhookSale[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Dados_antigos")}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const csv = await res.text();
  if (csv.length < 50 || csv.includes("Could not parse query")) return [];
  return parseOldDataRows(csv);
}
