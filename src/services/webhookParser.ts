import Papa from "papaparse";
import { parseBRNumber } from "./googleSheets";

export interface WebhookSale {
  date: string;
  dateObj: Date;
  hour: number;
  dayOfWeek: number;
  dayOfWeekLabel: string;
  event: "PURCHASE_APPROVED" | "PURCHASE_REFUNDED" | string;
  productId: string;
  productName: string;
  buyerName: string;
  /** Preço de venda (AJ) - purchase_original_offer_price_value */
  originalPrice: number;
  /** Comissão recebida (AL) - purchase_price_value */
  commissionReceived: number;
  /** Taxa da plataforma = |originalPrice| - |commissionReceived| */
  platformFee: number;
  paymentType: string;
  originSck: string;
  trackingSrc: string;
  trackingSrc2: string;
  trackingSck: string;
  trackingSck2: string;
  /** Classificação: "principal" | "upsell" | "orderbump" */
  productCategory: "principal" | "upsell" | "orderbump";
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function parseDateTimeSP(value: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    return new Date(
      parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
      parseInt(match[4]), parseInt(match[5]), parseInt(match[6])
    );
  }
  return null;
}

function classifyProduct(name: string): "principal" | "upsell" | "orderbump" {
  const lower = name.toLowerCase();
  if (lower.includes("pizza na prática") || lower.includes("pizza na pratica")) return "principal";
  if (lower.includes("bases gourmet") || lower.includes("bases gourmets") || lower.includes("pizza lucrativa")) return "upsell";
  return "orderbump";
}

export function parseWebhookRows(csvText: string): WebhookSale[] {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const headers = parsed.meta.fields || [];
  const findCol = (partials: string[]): string => {
    for (const p of partials) {
      const found = headers.find((h) => h.toLowerCase().includes(p.toLowerCase()));
      if (found) return found;
    }
    return "";
  };

  const colDateSP = findCol(["purchase_order_date_sp"]);
  const colEvent = findCol(["event"]);
  const colProductId = findCol(["product_id"]);
  const colProductName = findCol(["product_name"]);
  const colBuyer = findCol(["buyer_name"]);
  const colOriginalPrice = findCol(["purchase_original_offer_price_value"]);
  const colCommission = findCol(["purchase_price_value"]);
  const colPayment = findCol(["payment_type"]);
  const colOriginSck = findCol(["purchase_origin_sck"]);
  // Tracking columns (BB, BC, BD, BE)
  const colTrackSrc = findCol(["purchase_tracking_source"]);
  const colTrackSrc2 = findCol(["purchase_tracking_source2", "tracking_source_2"]);
  const colTrackSck = findCol(["purchase_tracking_sck"]);
  const colTrackSck2 = findCol(["purchase_tracking_sck2", "tracking_sck_2"]);

  // First pass: build product_id -> product_name map from approved sales
  const idToName = new Map<string, string>();
  for (const row of parsed.data as Record<string, string>[]) {
    const event = (row[colEvent] || "").trim();
    const productId = (row[colProductId] || "").trim();
    const productName = (row[colProductName] || "").trim();
    if (event.includes("APPROVED") && productId && productName) {
      idToName.set(productId, productName);
    }
  }

  const rows: WebhookSale[] = [];

  for (const row of parsed.data as Record<string, string>[]) {
    const event = (row[colEvent] || "").trim();
    if (!event || (!event.includes("APPROVED") && !event.includes("REFUNDED"))) continue;

    const dateObj = parseDateTimeSP(row[colDateSP] || "");
    if (!dateObj || isNaN(dateObj.getTime())) continue;

    const productId = (row[colProductId] || "").trim();
    let productName = (row[colProductName] || "").trim();

    // For refunds, resolve name from product_id if missing
    if (!productName && productId) {
      productName = idToName.get(productId) || `Produto ${productId}`;
    }
    if (!productName && !productId) continue;

    const originalPrice = parseBRNumber(row[colOriginalPrice] || "0");
    const commissionReceived = parseBRNumber(row[colCommission] || "0");
    const platformFee = Math.abs(originalPrice) - Math.abs(commissionReceived);

    rows.push({
      date: row[colDateSP] || "",
      dateObj,
      hour: dateObj.getHours(),
      dayOfWeek: dateObj.getDay(),
      dayOfWeekLabel: DAY_LABELS[dateObj.getDay()],
      event,
      productId,
      productName,
      buyerName: (row[colBuyer] || "").trim(),
      originalPrice,
      commissionReceived,
      platformFee: Math.max(0, platformFee),
      paymentType: (row[colPayment] || "").trim(),
      originSck: (row[colOriginSck] || "").trim(),
      trackingSrc: (row[colTrackSrc] || "").trim(),
      trackingSrc2: (row[colTrackSrc2] || "").trim(),
      trackingSck: (row[colTrackSck] || "").trim(),
      trackingSck2: (row[colTrackSck2] || "").trim(),
      productCategory: classifyProduct(productName),
    });
  }

  rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  return rows;
}

export async function fetchWebhookData(sheetId: string): Promise<WebhookSale[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("webhooks_pagamentos")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não foi possível carregar a aba webhooks_pagamentos");
  const csv = await res.text();
  return parseWebhookRows(csv);
}
