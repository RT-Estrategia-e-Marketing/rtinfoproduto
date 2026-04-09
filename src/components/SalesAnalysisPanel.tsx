import { useMemo } from "react";
import { type WebhookSale } from "@/services/webhookParser";
import { type SalesRow, formatCurrency, formatNumber } from "@/services/googleSheets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  LineChart, Line, ComposedChart, Area
} from "recharts";
import { ShoppingCart, Clock, TrendingUp, Package, RefreshCw } from "lucide-react";

interface Props {
  webhookData: WebhookSale[];
  dailyRows: SalesRow[];
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}h`);

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#f97316",
  "#06b6d4",
  "#8b5cf6",
];

export function SalesAnalysisPanel({ webhookData, dailyRows }: Props) {
  const approved = useMemo(() => webhookData.filter((s) => s.event.includes("APPROVED")), [webhookData]);
  const refunded = useMemo(() => webhookData.filter((s) => s.event.includes("REFUNDED")), [webhookData]);

  // Summary KPIs
  const kpis = useMemo(() => {
    const totalSales = approved.length;
    const totalRefunds = refunded.length;
    const totalRevenue = approved.reduce((s, r) => s + r.fullPrice, 0);
    const totalRefundValue = refunded.reduce((s, r) => s + r.fullPrice, 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const refundRate = totalSales > 0 ? (totalRefunds / (totalSales + totalRefunds)) * 100 : 0;
    return { totalSales, totalRefunds, totalRevenue, totalRefundValue, avgTicket, refundRate };
  }, [approved, refunded]);

  // Heatmap: hour x dayOfWeek
  const heatmapData = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const s of approved) {
      matrix[s.dayOfWeek][s.hour]++;
    }
    // Flatten for display
    const rows: { day: string; dayIdx: number; hour: string; hourIdx: number; count: number }[] = [];
    // Reorder: Mon-Sun
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
    const map = new Map<string, { name: string; count: number; revenue: number; refunds: number }>();
    for (const s of approved) {
      const entry = map.get(s.productName) || { name: s.productName, count: 0, revenue: 0, refunds: 0 };
      entry.count++;
      entry.revenue += s.fullPrice;
      map.set(s.productName, entry);
    }
    for (const s of refunded) {
      if (map.has(s.productName)) {
        map.get(s.productName)!.refunds++;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [approved, refunded]);

  // Sales by hour (bar chart)
  const salesByHour = useMemo(() => {
    const counts = new Array(24).fill(0);
    const revenue = new Array(24).fill(0);
    for (const s of approved) {
      counts[s.hour]++;
      revenue[s.hour] += s.fullPrice;
    }
    return HOUR_LABELS.map((h, i) => ({ hour: h, vendas: counts[i], faturamento: revenue[i] }));
  }, [approved]);

  // Timeline: daily sales vs investment
  const timelineData = useMemo(() => {
    const salesByDate = new Map<string, { vendas: number; faturamento: number }>();
    for (const s of approved) {
      const key = s.dateObj.toISOString().slice(0, 10);
      const entry = salesByDate.get(key) || { vendas: 0, faturamento: 0 };
      entry.vendas++;
      entry.faturamento += s.fullPrice;
      salesByDate.set(key, entry);
    }
    const investByDate = new Map<string, number>();
    for (const r of dailyRows) {
      const key = r.dateObj.toISOString().slice(0, 10);
      investByDate.set(key, (investByDate.get(key) || 0) + r.investment);
    }
    const allDates = new Set([...salesByDate.keys(), ...investByDate.keys()]);
    const sorted = Array.from(allDates).sort();
    return sorted.map((d) => ({
      date: d.slice(5),
      vendas: salesByDate.get(d)?.vendas || 0,
      faturamento: salesByDate.get(d)?.faturamento || 0,
      investimento: investByDate.get(d) || 0,
    }));
  }, [approved, dailyRows]);

  // Payment type distribution
  const paymentDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of approved) {
      const type = s.paymentType || "Outros";
      map.set(type, (map.get(type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [approved]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Vendas Aprovadas", value: kpis.totalSales, icon: ShoppingCart, format: "int" },
          { label: "Faturamento Total", value: kpis.totalRevenue, icon: TrendingUp, format: "currency" },
          { label: "Ticket Médio", value: kpis.avgTicket, icon: Package, format: "currency" },
          { label: "Reembolsos", value: kpis.totalRefunds, icon: RefreshCw, format: "int", negative: true },
          { label: "Valor Reembolsado", value: kpis.totalRefundValue, icon: RefreshCw, format: "currency", negative: true },
          { label: "Taxa Reembolso", value: kpis.refundRate, icon: Clock, format: "percent" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-lg font-bold ${kpi.negative ? "text-destructive" : ""}`}>
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
                  formatter={(value: number, name: string) => [name === "faturamento" ? formatCurrency(value) : value, name === "faturamento" ? "Faturamento" : "Vendas"]}
                />
                <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
                <div key={p.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <div className="flex gap-3 text-[11px] text-muted-foreground">
                      <span>{p.count} vendas</span>
                      <span>{formatCurrency(p.revenue)}</span>
                      <span>TM: {formatCurrency(p.revenue / p.count)}</span>
                      {p.refunds > 0 && <span className="text-destructive">{p.refunds} reembolsos</span>}
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

      {/* Timeline: Sales vs Investment */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">📈 Vendas x Investimento (Timeline Diária)</CardTitle>
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
                  if (name === "vendas") return [value, "Vendas"];
                  return [formatCurrency(value), name === "faturamento" ? "Faturamento" : "Investimento"];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="left" type="monotone" dataKey="faturamento" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" name="Faturamento" />
              <Line yAxisId="left" type="monotone" dataKey="investimento" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Investimento" />
              <Bar yAxisId="right" dataKey="vendas" fill="hsl(var(--chart-2) / 0.6)" radius={[2, 2, 0, 0]} name="Vendas" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      {paymentDist.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">💳 Métodos de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {paymentDist.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">({p.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
