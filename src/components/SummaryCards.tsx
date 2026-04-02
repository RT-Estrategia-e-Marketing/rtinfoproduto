import { type SalesSummary, formatCurrency, formatNumber } from "@/services/googleSheets";
import { DollarSign, TrendingUp, BarChart3, Ticket, CreditCard, TrendingDown, Target, Receipt } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SummaryCardsProps {
  summary: SalesSummary;
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tooltip: string;
  variant?: "default" | "success" | "danger" | "warning";
  delay?: number;
}

function MetricCard({ label, value, icon, tooltip, variant = "default", delay = 0 }: MetricCardProps) {
  const colorClasses = {
    default: "text-primary",
    success: "text-success",
    danger: "text-destructive",
    warning: "text-warning",
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="metric-card animate-fade-in cursor-help" style={{ animationDelay: `${delay}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="metric-label">{label}</span>
              <span className={colorClasses[variant]}>{icon}</span>
            </div>
            <p className={`metric-value ${colorClasses[variant]}`}>{value}</p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-line">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const s = summary;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Faturamento Bruto"
        value={formatCurrency(s.totalGrossRevenue)}
        icon={<DollarSign className="h-5 w-5" />}
        variant="default"
        delay={0}
        tooltip={`Soma de todos os faturamentos diários\n${s.daysCount} dias no período`}
      />
      <MetricCard
        label="Resultado Bruto"
        value={formatCurrency(s.totalGrossResult)}
        icon={<BarChart3 className="h-5 w-5" />}
        variant={s.totalGrossResult >= 0 ? "success" : "danger"}
        delay={50}
        tooltip={`Faturamento Bruto ${formatCurrency(s.totalGrossRevenue)} − Taxas ${formatCurrency(s.totalFees)}`}
      />
      <MetricCard
        label="Investimento"
        value={formatCurrency(s.totalInvestment)}
        icon={<CreditCard className="h-5 w-5" />}
        variant="warning"
        delay={100}
        tooltip={`Soma de todos os investimentos diários\n${s.daysCount} dias no período`}
      />
      <MetricCard
        label="Lucro Real"
        value={formatCurrency(s.totalRealProfit)}
        icon={<TrendingUp className="h-5 w-5" />}
        variant={s.totalRealProfit >= 0 ? "success" : "danger"}
        delay={150}
        tooltip={`Resultado Bruto ${formatCurrency(s.totalGrossResult)} − Investimento ${formatCurrency(s.totalInvestment)}`}
      />
      <MetricCard
        label="ROAS Médio"
        value={formatNumber(s.avgRoas)}
        icon={<Target className="h-5 w-5" />}
        variant={s.avgRoas >= 2 ? "success" : s.avgRoas >= 1 ? "warning" : "danger"}
        delay={200}
        tooltip={`Faturamento Bruto ${formatCurrency(s.totalGrossRevenue)} ÷ Investimento ${formatCurrency(s.totalInvestment)}\n= ${formatNumber(s.avgRoas)}`}
      />
      <MetricCard
        label="Taxas"
        value={formatCurrency(s.totalFees)}
        icon={<Receipt className="h-5 w-5" />}
        variant="danger"
        delay={250}
        tooltip={`Soma de todas as taxas diárias\n${s.daysCount} dias no período`}
      />
      <MetricCard
        label="Tickets Totais"
        value={s.totalTickets.toLocaleString("pt-BR")}
        icon={<Ticket className="h-5 w-5" />}
        delay={300}
        tooltip={`Soma de todos os tickets diários\n${s.daysCount} dias no período`}
      />
      <MetricCard
        label="Ticket Médio"
        value={formatCurrency(s.avgTicket)}
        icon={<TrendingDown className="h-5 w-5" />}
        delay={350}
        tooltip={`Faturamento Bruto ${formatCurrency(s.totalGrossRevenue)} ÷ Tickets ${s.totalTickets.toLocaleString("pt-BR")}\n= ${formatCurrency(s.avgTicket)}`}
      />
    </div>
  );
}
