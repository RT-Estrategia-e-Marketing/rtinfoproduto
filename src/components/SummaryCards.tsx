import { type SalesSummary, formatCurrency, formatNumber } from "@/services/googleSheets";
import { DollarSign, TrendingUp, BarChart3, Ticket, CreditCard, TrendingDown, Target, Receipt } from "lucide-react";

interface SummaryCardsProps {
  summary: SalesSummary;
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warning";
  delay?: number;
}

function MetricCard({ label, value, icon, variant = "default", delay = 0 }: MetricCardProps) {
  const colorClasses = {
    default: "text-primary",
    success: "text-success",
    danger: "text-destructive",
    warning: "text-warning",
  };

  return (
    <div className="metric-card animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="metric-label">{label}</span>
        <span className={colorClasses[variant]}>{icon}</span>
      </div>
      <p className={`metric-value ${colorClasses[variant]}`}>{value}</p>
    </div>
  );
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Faturamento Bruto"
        value={formatCurrency(summary.totalGrossRevenue)}
        icon={<DollarSign className="h-5 w-5" />}
        variant="default"
        delay={0}
      />
      <MetricCard
        label="Lucro Real"
        value={formatCurrency(summary.totalRealProfit)}
        icon={<TrendingUp className="h-5 w-5" />}
        variant={summary.totalRealProfit >= 0 ? "success" : "danger"}
        delay={50}
      />
      <MetricCard
        label="ROAS Médio"
        value={formatNumber(summary.avgRoas)}
        icon={<Target className="h-5 w-5" />}
        variant={summary.avgRoas >= 2 ? "success" : summary.avgRoas >= 1 ? "warning" : "danger"}
        delay={100}
      />
      <MetricCard
        label="Tickets Totais"
        value={summary.totalTickets.toLocaleString("pt-BR")}
        icon={<Ticket className="h-5 w-5" />}
        delay={150}
      />
      <MetricCard
        label="Investimento"
        value={formatCurrency(summary.totalInvestment)}
        icon={<CreditCard className="h-5 w-5" />}
        variant="warning"
        delay={200}
      />
      <MetricCard
        label="Taxas"
        value={formatCurrency(summary.totalFees)}
        icon={<Receipt className="h-5 w-5" />}
        variant="danger"
        delay={250}
      />
      <MetricCard
        label="Resultado Bruto"
        value={formatCurrency(summary.totalGrossResult)}
        icon={<BarChart3 className="h-5 w-5" />}
        variant={summary.totalGrossResult >= 0 ? "success" : "danger"}
        delay={300}
      />
      <MetricCard
        label="Ticket Médio"
        value={formatCurrency(summary.avgTicket)}
        icon={<TrendingDown className="h-5 w-5" />}
        delay={350}
      />
    </div>
  );
}
