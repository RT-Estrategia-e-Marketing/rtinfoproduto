import { type SalesRow } from "@/services/googleSheets";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface SalesChartsProps {
  rows: SalesRow[];
}

export function SalesCharts({ rows }: SalesChartsProps) {
  if (rows.length === 0) return null;

  const chartData = rows.map((r) => ({
    date: r.date.slice(0, 5), // DD/MM
    faturamento: r.grossRevenue,
    lucro: r.realProfit,
    investimento: r.investment,
    roas: r.roas,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="dashboard-section">
        <h3 className="text-lg font-heading font-semibold mb-4">Faturamento vs Lucro</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--chart-blue))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro Real" fill="hsl(var(--chart-green))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dashboard-section">
        <h3 className="text-lg font-heading font-semibold mb-4">ROAS Diário</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="roas"
                name="ROAS"
                stroke="hsl(var(--chart-orange))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--chart-orange))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dashboard-section lg:col-span-2">
        <h3 className="text-lg font-heading font-semibold mb-4">Investimento vs Retorno</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="investimento" name="Investimento" stroke="hsl(var(--chart-red))" strokeWidth={2} />
              <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke="hsl(var(--chart-blue))" strokeWidth={2} />
              <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--chart-green))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
