import { useMemo } from "react";
import { type SalesRow, formatCurrency, formatNumber } from "@/services/googleSheets";
import { TrendingUp, TrendingDown, AlertTriangle, Trophy, Calendar, Target, Zap, BarChart3 } from "lucide-react";

interface InsightsPanelProps {
  rows: SalesRow[];
  allRows: SalesRow[];
}

interface Insight {
  icon: React.ReactNode;
  title: string;
  description: string;
  type: "positive" | "negative" | "neutral" | "warning";
}

export function InsightsPanel({ rows, allRows }: InsightsPanelProps) {
  const insights = useMemo(() => {
    if (rows.length < 2) return [];
    const result: Insight[] = [];

    // Best and worst day by revenue
    const bestRevDay = rows.reduce((best, r) => r.grossRevenue > best.grossRevenue ? r : best, rows[0]);
    const worstRevDay = rows.reduce((worst, r) => r.grossRevenue < worst.grossRevenue ? r : worst, rows[0]);
    result.push({
      icon: <Trophy className="h-5 w-5" />,
      title: "Melhor dia em faturamento",
      description: `${bestRevDay.date} (${bestRevDay.dayOfWeek}) — ${formatCurrency(bestRevDay.grossRevenue)} com ${bestRevDay.tickets} tickets`,
      type: "positive",
    });

    // Best day by profit
    const bestProfitDay = rows.reduce((best, r) => r.realProfit > best.realProfit ? r : best, rows[0]);
    result.push({
      icon: <TrendingUp className="h-5 w-5" />,
      title: "Melhor dia em lucro",
      description: `${bestProfitDay.date} (${bestProfitDay.dayOfWeek}) — ${formatCurrency(bestProfitDay.realProfit)} de lucro real`,
      type: "positive",
    });

    // Worst day
    const worstProfitDay = rows.reduce((worst, r) => r.realProfit < worst.realProfit ? r : worst, rows[0]);
    if (worstProfitDay.realProfit < 0) {
      result.push({
        icon: <TrendingDown className="h-5 w-5" />,
        title: "Pior dia em lucro",
        description: `${worstProfitDay.date} (${worstProfitDay.dayOfWeek}) — ${formatCurrency(worstProfitDay.realProfit)} de prejuízo`,
        type: "negative",
      });
    }

    // Days with negative profit
    const negativeDays = rows.filter((r) => r.realProfit < 0);
    if (negativeDays.length > 0) {
      const pct = ((negativeDays.length / rows.length) * 100).toFixed(0);
      result.push({
        icon: <AlertTriangle className="h-5 w-5" />,
        title: "Dias no prejuízo",
        description: `${negativeDays.length} de ${rows.length} dias (${pct}%) tiveram lucro negativo`,
        type: "warning",
      });
    }

    // Best ROAS day
    const bestRoasDay = rows.reduce((best, r) => r.roas > best.roas ? r : best, rows[0]);
    if (bestRoasDay.roas > 0) {
      result.push({
        icon: <Target className="h-5 w-5" />,
        title: "Melhor ROAS",
        description: `${bestRoasDay.date} — ROAS de ${formatNumber(bestRoasDay.roas)} (investiu ${formatCurrency(bestRoasDay.investment)}, faturou ${formatCurrency(bestRoasDay.grossRevenue)})`,
        type: "positive",
      });
    }

    // Revenue trend (first half vs second half)
    if (rows.length >= 6) {
      const mid = Math.floor(rows.length / 2);
      const firstHalf = rows.slice(0, mid);
      const secondHalf = rows.slice(mid);
      const avgFirst = firstHalf.reduce((s, r) => s + r.grossRevenue, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, r) => s + r.grossRevenue, 0) / secondHalf.length;
      const change = ((avgSecond - avgFirst) / avgFirst) * 100;
      if (Math.abs(change) > 5) {
        result.push({
          icon: change > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />,
          title: "Tendência de faturamento",
          description: `Média diária ${change > 0 ? "subiu" : "caiu"} ${Math.abs(change).toFixed(1)}% na segunda metade do período (${formatCurrency(avgFirst)} → ${formatCurrency(avgSecond)})`,
          type: change > 0 ? "positive" : "negative",
        });
      }
    }

    // Monthly projection
    const totalRevenue = rows.reduce((s, r) => s + r.grossRevenue, 0);
    const totalProfit = rows.reduce((s, r) => s + r.realProfit, 0);
    const avgDailyRevenue = totalRevenue / rows.length;
    const avgDailyProfit = totalProfit / rows.length;
    result.push({
      icon: <Calendar className="h-5 w-5" />,
      title: "Projeção mensal (30 dias)",
      description: `Faturamento estimado: ${formatCurrency(avgDailyRevenue * 30)} · Lucro estimado: ${formatCurrency(avgDailyProfit * 30)}`,
      type: "neutral",
    });

    // Best weekday
    const weekdayStats = new Map<string, { revenue: number; count: number }>();
    for (const r of rows) {
      if (!r.dayOfWeek) continue;
      const existing = weekdayStats.get(r.dayOfWeek) || { revenue: 0, count: 0 };
      existing.revenue += r.grossRevenue;
      existing.count++;
      weekdayStats.set(r.dayOfWeek, existing);
    }
    if (weekdayStats.size > 0) {
      let bestDay = "";
      let bestAvg = 0;
      for (const [day, stats] of weekdayStats) {
        const avg = stats.revenue / stats.count;
        if (avg > bestAvg) { bestAvg = avg; bestDay = day; }
      }
      result.push({
        icon: <Zap className="h-5 w-5" />,
        title: "Melhor dia da semana",
        description: `${bestDay} com média de ${formatCurrency(bestAvg)} de faturamento`,
        type: "positive",
      });
    }

    // Fee impact
    const totalFees = rows.reduce((s, r) => s + r.fees, 0);
    const feePct = totalRevenue > 0 ? (totalFees / totalRevenue) * 100 : 0;
    result.push({
      icon: <BarChart3 className="h-5 w-5" />,
      title: "Impacto das taxas",
      description: `Taxas consomem ${feePct.toFixed(1)}% do faturamento bruto (${formatCurrency(totalFees)} de ${formatCurrency(totalRevenue)})`,
      type: feePct > 15 ? "warning" : "neutral",
    });

    return result;
  }, [rows, allRows]);

  if (insights.length === 0) {
    return (
      <div className="dashboard-section text-center py-12">
        <p className="text-muted-foreground">Dados insuficientes para gerar insights.</p>
      </div>
    );
  }

  const typeStyles = {
    positive: "border-l-success bg-success/5",
    negative: "border-l-destructive bg-destructive/5",
    warning: "border-l-warning bg-warning/5",
    neutral: "border-l-primary bg-primary/5",
  };
  const iconStyles = {
    positive: "text-success",
    negative: "text-destructive",
    warning: "text-warning",
    neutral: "text-primary",
  };

  return (
    <div className="space-y-3">
      {insights.map((insight, i) => (
        <div
          key={i}
          className={`rounded-lg border-l-4 p-4 transition-all duration-200 hover:shadow-md animate-fade-in ${typeStyles[insight.type]}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 ${iconStyles[insight.type]}`}>{insight.icon}</span>
            <div>
              <h4 className="font-heading font-semibold text-sm">{insight.title}</h4>
              <p className="text-sm text-muted-foreground mt-0.5">{insight.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
