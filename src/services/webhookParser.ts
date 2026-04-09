import Papa from "papaparse";
import { parseBRNumber } from "./googleSheets";

export interface WebhookSale {
  date: string;
  dateObj: Date;
  hour: number;
  dayOfWeek: number; // 0=Sun...6=Sat
  dayOfWeekLabel: string;
  event: "PURCHASE_APPROVED" | "PURCHASE_REFUNDED" | string;
  productName: string;
  fullPrice: number;
  producerCommission: number;
  marketplaceCommission: number;
  paymentType: string;
  buyerName: string;
  offerName: string;
  funnelName: string;
  isOrderBump: boolean;
  isUpsell: boolean;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function parseDateTimeSP(value: string): Date | null {
  if (!value) return null;
  // format: "2026-03-25 16:23:24"
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    return new Date(
      parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
      parseInt(match[4]), parseInt(match[5]), parseInt(match[6])
    );
  }
  return null;
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
  const colProduct = findCol(["product_name"]);
  const colFullPrice = findCol(["purchase_full_price_value"]);
  const colProducerComm = findCol(["commissions_producer_value"]);
  const colMarketplaceComm = findCol(["commissions_marketplace_value"]);
  const colPayment = findCol(["payment_type"]);
  const colBuyer = findCol(["buyer_name"]);
  const colOffer = findCol(["purchase_offer_name"]);
  const colFunnel = findCol(["purchase_funnel_name"]);
  const colOrderBump = findCol(["purchase_order_bump_is_order_bump"]);
  const colUpsell = findCol(["purchase_upsell_is_upsell"]);

  const rows: WebhookSale[] = [];

  for (const row of parsed.data as Record<string, string>[]) {
    const event = (row[colEvent] || "").trim();
    if (!event || (!event.includes("APPROVED") && !event.includes("REFUNDED"))) continue;

    const dateObj = parseDateTimeSP(row[colDateSP] || "");
    if (!dateObj || isNaN(dateObj.getTime())) continue;

    const productName = (row[colProduct] || "").trim();
    if (!productName) continue;

    rows.push({
      date: row[colDateSP] || "",
      dateObj,
      hour: dateObj.getHours(),
      dayOfWeek: dateObj.getDay(),
      dayOfWeekLabel: DAY_LABELS[dateObj.getDay()],
      event,
      productName,
      fullPrice: parseBRNumber(row[colFullPrice] || "0"),
      producerCommission: parseBRNumber(row[colProducerComm] || "0"),
      marketplaceCommission: parseBRNumber(row[colMarketplaceComm] || "0"),
      paymentType: (row[colPayment] || "").trim(),
      buyerName: (row[colBuyer] || "").trim(),
      offerName: (row[colOffer] || "").trim(),
      funnelName: (row[colFunnel] || "").trim(),
      isOrderBump: (row[colOrderBump] || "").toUpperCase() === "TRUE",
      isUpsell: (row[colUpsell] || "").toUpperCase() === "TRUE",
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
