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
  trafficUpdateTime?: string | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tooltip: string;
  variant?: "default" | "success" | "danger" | "warning";
  delay?: number;
  gradient?: string;
}

function MetricCard({ label, value, icon, tooltip, variant = "default", delay = 0, gradient }: MetricCardProps) {
  const iconBg = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/10 text-warning",
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="group relative bg-card rounded-xl border border-border p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 cursor-help overflow-hidden animate-fade-in"
            style={{ animationDelay: `${delay}ms` }}
          >
            {gradient && (
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient}`} />
            )}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg[variant]}`}>
                  {icon}
                </div>
              </div>
              <p className="text-2xl font-heading font-bold tracking-tight">{value}</p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-line">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SummaryCards({ summary, trafficUpdateTime }: SummaryCardsProps) {
  const s = summary;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Faturamento Bruto"
        value={formatCurrency(s.totalGrossRevenue)}
        icon={<DollarSign className="h-4 w-4" />}
        variant="default"
        delay={0}
        gradient="bg-gradient-to-br from-primary/5 to-transparent"
        tooltip={`Soma de todos os faturamentos diários\n${s.daysCount} dias no período`}
      />
      <MetricCard
        label="Resultado Bruto"
        value={formatCurrency(s.totalGrossResult)}
        icon={<BarChart3 className="h-4 w-4" />}
        variant={s.totalGrossResult >= 0 ? "success" : "danger"}
        delay={50}
        gradient="bg-gradient-to-br from-success/5 to-transparent"
        tooltip={`Faturamento Bruto ${formatCurrency(s.totalGrossRevenue)} − Taxas ${formatCurrency(s.totalFees)}`}
      />
      <MetricCard
        label="Investimento"
        value={formatCurrency(s.totalInvestment)}
        icon={<CreditCard className="h-4 w-4" />}
        variant="warning"
        delay={100}
        gradient="bg-gradient-to-br from-warning/5 to-transparent"
        tooltip={`Soma de todos os investimentos diários\n${s.daysCount} dias no período${trafficUpdateTime ? `\n\n📊 Última atualização do tráfego:\n${trafficUpdateTime}` : ""}`}
      />
      <MetricCard
        label="Lucro Real"
        value={formatCurrency(s.totalRealProfit)}
        icon={<TrendingUp className="h-4 w-4" />}
        variant={s.totalRealProfit >= 0 ? "success" : "danger"}
        delay={150}
        gradient="bg-gradient-to-br from-success/5 to-transparent"
        tooltip={`Resultado Bruto ${formatCurrency(s.totalGrossResult)} − Investimento ${formatCurrency(s.totalInvestment)}`}
      />
      <MetricCard
        label="ROAS Médio"
        value={formatNumber(s.avgRoas)}
        icon={<Target className="h-4 w-4" />}
        variant={s.avgRoas >= 0 ? "success" : "danger"}
        delay={200}
        tooltip={`Lucro Real ${formatCurrency(s.totalRealProfit)} ÷ Investimento ${formatCurrency(s.totalInvestment)}\n= ${formatNumber(s.avgRoas)}`}
      />
      <MetricCard
        label="Taxas"
        value={formatCurrency(s.totalFees)}
        icon={<Receipt className="h-4 w-4" />}
        variant="danger"
        delay={250}
        tooltip={`Soma de todas as taxas diárias\n${s.daysCount} dias no período`}
      />
      <MetricCard
        label="Tickets Totais"
        value={s.totalTickets.toLocaleString("pt-BR")}
        icon={<Ticket className="h-4 w-4" />}
        delay={300}
        tooltip={`Soma de todos os tickets diários\n${s.daysCount} dias no período`}
      />
      <MetricCard
        label="Ticket Médio"
        value={formatCurrency(s.avgTicket)}
        icon={<TrendingDown className="h-4 w-4" />}
        delay={350}
        tooltip={`Faturamento Bruto ${formatCurrency(s.totalGrossRevenue)} ÷ Tickets ${s.totalTickets.toLocaleString("pt-BR")}\n= ${formatCurrency(s.avgTicket)}`}
      />
    </div>
  );
}
