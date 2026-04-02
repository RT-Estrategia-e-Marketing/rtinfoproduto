import { useMemo } from "react";
import { type SalesRow, formatCurrency } from "@/services/googleSheets";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface SalesChartsProps {
  rows: SalesRow[];
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: 12,
};

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`dashboard-section ${className}`}>
      <h3 className="text-sm font-heading font-semibold mb-4 text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="h-72">{children}</div>
    </div>
  );
}

export function SalesCharts({ rows }: SalesChartsProps) {
  if (rows.length === 0) return null;

  const chartData = useMemo(() => rows.map((r) => ({
    date: r.date.slice(0, 5),
    faturamento: r.grossRevenue,
    lucro: r.realProfit,
    investimento: r.investment,
    resultadoBruto: r.grossResult,
    roas: r.roas,
    tickets: r.tickets,
  })), [rows]);

  const cumulativeData = useMemo(() => {
    let acc = 0;
    return rows.map((r) => {
      acc += r.grossRevenue;
      return { date: r.date.slice(0, 5), acumulado: acc };
    });
  }, [rows]);

  const pieData = useMemo(() => {
    const totalFees = rows.reduce((s, r) => s + r.fees, 0);
    const totalInvestment = rows.reduce((s, r) => s + r.investment, 0);
    const totalProfit = rows.reduce((s, r) => s + r.realProfit, 0);
    return [
      { name: "Taxas", value: Math.abs(totalFees) },
      { name: "Investimento", value: Math.abs(totalInvestment) },
      { name: "Lucro Real", value: Math.max(0, totalProfit) },
    ];
  }, [rows]);

  const PIE_COLORS = ["hsl(var(--chart-red))", "hsl(var(--chart-orange))", "hsl(var(--chart-green))"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartCard title="Faturamento x Lucro x Investimento x Resultado" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--chart-blue))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="resultadoBruto" name="Resultado Bruto" fill="hsl(var(--chart-purple))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="investimento" name="Investimento" fill="hsl(var(--chart-orange))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lucro" name="Lucro Real" fill="hsl(var(--chart-green))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="ROAS Diário">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="roas" name="ROAS" stroke="hsl(var(--chart-orange))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-orange))" }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Faturamento Acumulado">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={cumulativeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-blue))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-blue))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
            <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--chart-blue))" fill="url(#gradBlue)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Investimento vs Retorno">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="investimento" name="Investimento" stroke="hsl(var(--chart-red))" strokeWidth={2} />
            <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke="hsl(var(--chart-blue))" strokeWidth={2} />
            <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--chart-green))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Distribuição de Custos vs Lucro">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tickets Diários">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="tickets" name="Tickets" fill="hsl(var(--chart-purple))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
