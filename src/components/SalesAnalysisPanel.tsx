import { useState, useMemo } from "react";
import { getLocalDateKey } from "@/services/dateUtils";
import { type WebhookSale } from "@/services/webhookParser";
import { type SalesRow, formatCurrency, formatNumber } from "@/services/googleSheets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart, Area, Line
} from "recharts";
import { ShoppingCart, Clock, TrendingUp, Package, RefreshCw, Users, Tag, CreditCard, Coins } from "lucide-react";

interface Props {
  webhookData: WebhookSale[];
  dailyRows: SalesRow[];
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}h`);

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 95%, 55%)",
  "hsl(280, 65%, 60%)",
  "hsl(350, 80%, 55%)",
  "#f97316",
  "#06b6d4",
  "#8b5cf6",
];

const TRACKING_OPTIONS = [
  { value: "originSck", label: "Origem SCK (BA)" },
  { value: "utmCampaign", label: "UTM Campaign (BB)" },
  { value: "utmMedium", label: "UTM Medium (BC)" },
  { value: "utmSource", label: "UTM Source (BD)" },
  { value: "utmContent", label: "UTM Content (BE)" },
] as const;

type TrackingKey = typeof TRACKING_OPTIONS[number]["value"];

export function SalesAnalysisPanel({ webhookData, dailyRows }: Props) {
  const [trackingColumn, setTrackingColumn] = useState<TrackingKey>("originSck");
  const [originMetric, setOriginMetric] = useState<"tickets" | "revenue" | "clients">("tickets");

  const approved = useMemo(() => webhookData.filter((s) => s.event.toUpperCase().includes("APPROVED")), [webhookData]);
  const refunded = useMemo(() => webhookData.filter((s) => s.event.toUpperCase().includes("REFUNDED")), [webhookData]);

  const totalInvestment = useMemo(() => dailyRows.reduce((s, r) => s + r.investment, 0), [dailyRows]);

  const kpis = useMemo(() => {
    const totalSales = approved.length;
    const totalRefunds = refunded.length;
    const grossRevenue = approved.reduce((s, r) => s + r.originalPrice, 0);
    const grossCommission = approved.reduce((s, r) => s + r.commissionReceived, 0);
    const grossFees = approved.reduce((s, r) => s + r.platformFee, 0);
    const refundRevenue = refunded.reduce((s, r) => s + Math.abs(r.originalPrice), 0);
    const refundCommission = refunded.reduce((s, r) => s + Math.abs(r.commissionReceived), 0);
    const refundFees = refunded.reduce((s, r) => s + r.platformFee, 0);
    const netRevenue = grossRevenue - refundRevenue;
    const netCommission = grossCommission - refundCommission;
    const netFees = grossFees - Math.abs(refundFees);
    const uniqueBuyers = new Set(approved.map((s) => s.buyerName.toLowerCase().trim()).filter(Boolean)).size;
    const avgTicket = uniqueBuyers > 0 ? grossRevenue / uniqueBuyers : 0;
    const refundRate = totalSales > 0 ? (totalRefunds / (totalSales + totalRefunds)) * 100 : 0;
    const uniqueRefundBuyers = new Set(refunded.map((s) => s.buyerName.toLowerCase().trim()).filter(Boolean)).size;
    const profit = netCommission - totalInvestment;
    return { totalSales, totalRefunds, grossRevenue, grossCommission, grossFees, refundRevenue, refundCommission, netRevenue, netCommission, netFees, avgTicket, refundRate, uniqueBuyers, uniqueRefundBuyers, profit };
  }, [approved, refunded, totalInvestment]);

  // Product category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats = {
      principal: { sold: 0, refunded: 0, revenue: 0, commission: 0 },
      upsell: { sold: 0, refunded: 0, revenue: 0, commission: 0 },
      orderbump: { sold: 0, refunded: 0, revenue: 0, commission: 0 },
    };
    for (const s of approved) {
      cats[s.productCategory].sold++;
      cats[s.productCategory].revenue += s.originalPrice;
      cats[s.productCategory].commission += s.commissionReceived;
    }
    for (const s of refunded) {
      cats[s.productCategory].refunded++;
    }
    return cats;
  }, [approved, refunded]);

  // Unique customers per day
  const uniqueCustomersPerDay = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of approved) {
      const key = getLocalDateKey(s.dateObj);
      if (!map.has(key)) map.set(key, new Set());
      if (s.buyerName) map.get(key)!.add(s.buyerName.toLowerCase().trim());
    }
    return map;
  }, [approved]);

  // Heatmap
  const heatmapData = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const s of approved) matrix[s.dayOfWeek][s.hour]++;
    const rows: { day: string; dayIdx: number; hour: string; hourIdx: number; count: number }[] = [];
    const orderedDays = [1, 2, 3, 4, 5, 6, 0];
    for (const d of orderedDays) {
      for (let h = 0; h < 24; h++) {
        rows.push({ day: DAY_LABELS[d], dayIdx: d, hour: HOUR_LABELS[h], hourIdx: h, count: matrix[d][h] });
      }
    }
    const maxCount = Math.max(...rows.map((r) => r.count), 1);
    return { rows, maxCount };
  }, [approved]);

  // Product ranking
  const productRanking = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; revenue: number; commission: number; refunds: number; refundValue: number }>();
    for (const s of approved) {
      const key = s.productId || s.productName;
      const entry = map.get(key) || { id: s.productId, name: s.productName, count: 0, revenue: 0, commission: 0, refunds: 0, refundValue: 0 };
      entry.count++;
      entry.revenue += s.originalPrice;
      entry.commission += s.commissionReceived;
      if (!entry.name && s.productName) entry.name = s.productName;
      map.set(key, entry);
    }
    for (const s of refunded) {
      const key = s.productId || s.productName;
      if (map.has(key)) {
        map.get(key)!.refunds++;
        map.get(key)!.refundValue += Math.abs(s.originalPrice);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [approved, refunded]);

  // Sales by hour with % of total, unique clients and % of unique clients
  const salesByHour = useMemo(() => {
    const counts = new Array(24).fill(0);
    const revenue = new Array(24).fill(0);
    const uniqueByHour: Set<string>[] = Array.from({ length: 24 }, () => new Set());
    for (const s of approved) {
      counts[s.hour]++;
      revenue[s.hour] += s.originalPrice;
      if (s.buyerName) uniqueByHour[s.hour].add(s.buyerName.toLowerCase().trim());
    }
    const total = approved.length || 1;
    const totalUniqueClients = new Set(approved.map((s) => s.buyerName.toLowerCase().trim()).filter(Boolean)).size || 1;
    return HOUR_LABELS.map((h, i) => ({
      hour: h,
      vendas: counts[i],
      faturamento: revenue[i],
      percentual: parseFloat(((counts[i] / total) * 100).toFixed(1)),
      clientes: uniqueByHour[i].size,
      percentualClientes: parseFloat(((uniqueByHour[i].size / totalUniqueClients) * 100).toFixed(1)),
    }));
  }, [approved]);

  // Timeline
  const timelineData = useMemo(() => {
    const salesByDate = new Map<string, { vendas: number; faturamento: number; clientes: number }>();
    for (const s of approved) {
      const key = getLocalDateKey(s.dateObj);
      const entry = salesByDate.get(key) || { vendas: 0, faturamento: 0, clientes: 0 };
      entry.vendas++;
      entry.faturamento += s.originalPrice;
      salesByDate.set(key, entry);
    }
    for (const [key, buyers] of uniqueCustomersPerDay) {
      if (salesByDate.has(key)) salesByDate.get(key)!.clientes = buyers.size;
    }
    const investByDate = new Map<string, number>();
    for (const r of dailyRows) {
      const key = getLocalDateKey(r.dateObj);
      investByDate.set(key, (investByDate.get(key) || 0) + r.investment);
    }
    const allDates = new Set([...salesByDate.keys(), ...investByDate.keys()]);
    return Array.from(allDates).sort().map((d) => ({
      date: d.slice(5),
      Vendas: salesByDate.get(d)?.vendas || 0,
      "Clientes Únicos": salesByDate.get(d)?.clientes || 0,
      Faturamento: salesByDate.get(d)?.faturamento || 0,
      Investimento: investByDate.get(d) || 0,
    }));
  }, [approved, dailyRows, uniqueCustomersPerDay]);

  // Payment type distribution with unique customers
  const paymentDist = useMemo(() => {
    const normalizePayment = (type: string): string => {
      const lower = type.toLowerCase().trim();
      if (lower === "pix") return "PIX";
      if (lower === "credit_card" || lower === "cartao credito" || lower === "cartão crédito" || lower === "cartão de crédito" || lower === "cartao de credito") return "Cartão de Crédito";
      if (lower === "boleto" || lower === "billet") return "Boleto";
      if (!type.trim()) return "Outros";
      return type.trim();
    };
    const countMap = new Map<string, number>();
    const uniqueMap = new Map<string, Set<string>>();
    for (const s of approved) {
      const type = normalizePayment(s.paymentType);
      countMap.set(type, (countMap.get(type) || 0) + 1);
      if (!uniqueMap.has(type)) uniqueMap.set(type, new Set());
      if (s.buyerName) uniqueMap.get(type)!.add(s.buyerName.toLowerCase().trim());
    }
    return Array.from(countMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        uniqueCustomers: uniqueMap.get(name)?.size || 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [approved]);

  // Origin distribution with tickets, revenue, and unique clients
  const originDist = useMemo(() => {
    const ticketMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    const clientMap = new Map<string, Set<string>>();
    for (const s of approved) {
      const value = s[trackingColumn] || "<vazio>";
      ticketMap.set(value, (ticketMap.get(value) || 0) + 1);
      revenueMap.set(value, (revenueMap.get(value) || 0) + s.originalPrice);
      if (!clientMap.has(value)) clientMap.set(value, new Set());
      if (s.buyerName) clientMap.get(value)!.add(s.buyerName.toLowerCase().trim());
    }
    return Array.from(ticketMap.entries())
      .map(([name]) => ({
        name,
        tickets: ticketMap.get(name) || 0,
        revenue: revenueMap.get(name) || 0,
        clients: clientMap.get(name)?.size || 0,
      }))
      .sort((a, b) => {
        if (originMetric === "revenue") return b.revenue - a.revenue;
        if (originMetric === "clients") return b.clients - a.clients;
        return b.tickets - a.tickets;
      })
      .slice(0, 15);
  }, [approved, trackingColumn, originMetric]);

  // Conversão líquida: vendas líquidas (sem reembolsos)
  const principalNet = categoryBreakdown.principal.sold - categoryBreakdown.principal.refunded;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Vendas Aprovadas", value: kpis.totalSales, icon: ShoppingCart, format: "int" as const },
          { label: "Clientes Únicos", value: kpis.uniqueBuyers, icon: Users, format: "int" as const },
          { label: "Faturamento Bruto", value: kpis.netRevenue, icon: TrendingUp, format: "currency" as const },
          { label: "Comissão Líquida", value: kpis.netCommission, icon: Package, format: "currency" as const },
          { label: "Investimento", value: totalInvestment, icon: CreditCard, format: "currency" as const, warning: true },
          { label: "Lucro", value: kpis.profit, icon: Coins, format: "currency" as const, profit: true },
          { label: "Taxas Líquidas", value: kpis.netFees, icon: Tag, format: "currency" as const },
          { label: "Ticket Médio (por cliente)", value: kpis.avgTicket, icon: Clock, format: "currency" as const },
          { label: "Produtos Reembolsados", value: kpis.totalRefunds, icon: RefreshCw, format: "int" as const, negative: true },
          { label: "Clientes c/ Reembolso", value: kpis.uniqueRefundBuyers, icon: Users, format: "int" as const, negative: true },
          { label: "Valor Reembolsado", value: kpis.refundRevenue, icon: RefreshCw, format: "currency" as const, negative: true },
          { label: "Taxa Reembolso", value: kpis.refundRate, icon: Clock, format: "percent" as const },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-lg font-bold ${"negative" in kpi && kpi.negative ? "text-destructive" : "warning" in kpi && kpi.warning ? "text-yellow-600 dark:text-yellow-400" : "profit" in kpi && kpi.profit ? (kpi.value >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive") : ""}`}>
                {kpi.format === "currency"
                  ? formatCurrency(kpi.value)
                  : kpi.format === "percent"
                  ? `${formatNumber(kpi.value, 1)}%`
                  : kpi.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Product Category Breakdown */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">📦 Breakdown: Principal x Upsell x Order Bump</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { key: "principal" as const, label: "Principal (Pizza na Prática)", color: "hsl(var(--primary))" },
              { key: "upsell" as const, label: "Upsell (Bases Gourmets / Pizza Lucrativa)", color: "hsl(var(--chart-2))" },
              { key: "orderbump" as const, label: "Order Bump (Outros)", color: "hsl(var(--chart-3))" },
            ]).map((cat) => {
              const data = categoryBreakdown[cat.key];
              const netTickets = data.sold - data.refunded;
              // Conversão baseada em vendas líquidas
              const conversionRate = cat.key !== "principal" && principalNet > 0
                ? (((data.sold - data.refunded) / principalNet) * 100)
                : null;
              return (
                <div key={cat.key} className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-semibold">{cat.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Vendidos:</span> <strong>{data.sold}</strong></div>
                    <div><span className="text-muted-foreground">Reembolsados:</span> <strong className="text-destructive">{data.refunded}</strong></div>
                    <div><span className="text-muted-foreground">Líquido:</span> <strong>{netTickets}</strong></div>
                    <div><span className="text-muted-foreground">Faturamento:</span> <strong>{formatCurrency(data.revenue)}</strong></div>
                  </div>
                  {conversionRate !== null && (
                    <div className="pt-1 border-t border-border">
                      <span className="text-xs text-muted-foreground">Conversão vs Principal (líquido): </span>
                      <strong className="text-xs text-primary">{formatNumber(conversionRate, 1)}%</strong>
                      <span className="text-[10px] text-muted-foreground ml-1">({data.sold - data.refunded}/{principalNet})</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">🔥 Heatmap de Vendas por Horário e Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="flex gap-0.5 mb-1">
                <div className="w-10" />
                {HOUR_LABELS.map((h) => (
                  <div key={h} className="flex-1 text-[9px] text-center text-muted-foreground">{h.replace("h", "")}</div>
                ))}
              </div>
              {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => (
                <div key={dayIdx} className="flex gap-0.5 mb-0.5">
                  <div className="w-10 text-[10px] text-muted-foreground flex items-center">{DAY_LABELS[dayIdx]}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = heatmapData.rows.find((r) => r.dayIdx === dayIdx && r.hourIdx === h);
                    const count = cell?.count || 0;
                    const intensity = count / heatmapData.maxCount;
                    return (
                      <div
                        key={h}
                        className="flex-1 aspect-square rounded-sm flex items-center justify-center text-[8px] font-medium transition-colors"
                        style={{
                          backgroundColor: count === 0
                            ? "hsl(var(--muted))"
                            : `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
                          color: intensity > 0.5 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                        }}
                        title={`${DAY_LABELS[dayIdx]} ${HOUR_LABELS[h]}: ${count} vendas`}
                      >
                        {count > 0 ? count : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2 justify-end">
                <span className="text-[9px] text-muted-foreground">Menos</span>
                {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                  <div
                    key={v}
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: v === 0 ? "hsl(var(--muted))" : `hsl(var(--primary) / ${0.15 + v * 0.85})` }}
                  />
                ))}
                <span className="text-[9px] text-muted-foreground">Mais</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Hour */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">⏰ Vendas por Horário</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={salesByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    if (name === "% Tickets") return [`${value}%`, "% Tickets do Total"];
                    if (name === "% Clientes") return [`${value}%`, "% Clientes do Total"];
                    if (name === "Faturamento") return [formatCurrency(value), "Faturamento"];
                    if (name === "Clientes Únicos") return [value, "Clientes Únicos"];
                    return [value, "Tickets"];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="vendas" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Tickets" />
                <Bar dataKey="percentual" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} name="% Tickets" />
                <Bar dataKey="clientes" fill="hsl(280, 65%, 60%)" radius={[4, 4, 0, 0]} name="Clientes Únicos" />
                <Bar dataKey="percentualClientes" fill="hsl(30, 95%, 55%)" radius={[4, 4, 0, 0]} name="% Clientes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Product Ranking */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">🏆 Ranking de Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {productRanking.map((p, i) => (
                <div key={p.id || p.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <div className="flex gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span>{p.count} vendas</span>
                      <span>Bruto: {formatCurrency(p.revenue)}</span>
                      <span>Comissão: {formatCurrency(p.commission)}</span>
                      <span>TM: {formatCurrency(p.count > 0 ? p.revenue / p.count : 0)}</span>
                      {p.refunds > 0 && <span className="text-destructive">{p.refunds} reemb. ({formatCurrency(p.refundValue)})</span>}
                    </div>
                  </div>
                  <div className="w-20">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.revenue / (productRanking[0]?.revenue || 1)) * 100}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {productRanking.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto encontrado</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">📈 Vendas x Investimento x Clientes (Timeline Diária)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => {
                  if (name === "Vendas" || name === "Clientes Únicos") return [value, name];
                  return [formatCurrency(value), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="left" type="monotone" dataKey="Faturamento" fill="hsla(217, 91%, 60%, 0.15)" stroke="hsl(217, 91%, 60%)" />
              <Line yAxisId="left" type="monotone" dataKey="Investimento" stroke="hsl(30, 95%, 55%)" strokeWidth={2} dot={false} />
              <Bar yAxisId="right" dataKey="Vendas" fill="hsl(160, 60%, 45%)" radius={[2, 2, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="Clientes Únicos" stroke="hsl(280, 65%, 60%)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        {paymentDist.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">💳 Métodos de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {paymentDist.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium flex-1">{p.name}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold">{p.value} vendas</span>
                      <span className="text-[11px] text-muted-foreground ml-2">({p.uniqueCustomers} clientes únicos)</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Origin / Source with selector */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold">🎯 Origem das Vendas (Top 15)</CardTitle>
                <Select value={trackingColumn} onValueChange={(v) => setTrackingColumn(v as TrackingKey)}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKING_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                {([
                  { key: "tickets" as const, label: "Tickets" },
                  { key: "revenue" as const, label: "Faturamento" },
                  { key: "clients" as const, label: "Clientes Únicos" },
                ]).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setOriginMetric(m.key)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      originMetric === m.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {originDist.map((o, i) => {
                const displayValue = originMetric === "revenue" ? o.revenue : originMetric === "clients" ? o.clients : o.tickets;
                const maxValue = originDist[0] ? (originMetric === "revenue" ? originDist[0].revenue : originMetric === "clients" ? originDist[0].clients : originDist[0].tickets) : 1;
                return (
                  <div key={o.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm flex-1 truncate">{o.name}</span>
                    <span className="text-sm font-bold">
                      {originMetric === "revenue" ? formatCurrency(displayValue) : displayValue}
                    </span>
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${(displayValue / (maxValue || 1)) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
              {originDist.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma origem encontrada</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
