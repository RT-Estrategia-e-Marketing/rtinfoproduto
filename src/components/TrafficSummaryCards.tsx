import {
  type TrafficSummary,
  type TrafficRow,
  getTrafficMetricHeaders,
} from "@/services/trafficService";
import { type SalesSummary, formatCurrency, formatNumber } from "@/services/googleSheets";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Receipt,
  Target,
  Activity,
  Layers,
  TrendingDown,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TrafficSummaryCardsProps {
  trafficSummary: TrafficSummary;
  financialSummary: SalesSummary;
  trafficRows: TrafficRow[];
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tooltip: string;
  variant?: "default" | "success" | "danger" | "warning" | "info";
  delay?: number;
}

function MetricCard({
  label,
  value,
  icon,
  tooltip,
  variant = "default",
  delay = 0,
}: MetricCardProps) {
  const iconBg: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-500",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-amber-500/10 text-amber-500",
    info: "bg-sky-500/10 text-sky-500",
  };

  const gradients: Record<string, string> = {
    default: "from-primary/5",
    success: "from-emerald-500/5",
    danger: "from-destructive/5",
    warning: "from-amber-500/5",
    info: "from-sky-500/5",
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="group relative bg-card rounded-xl border border-border p-4 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 cursor-help overflow-hidden animate-fade-in"
            style={{ animationDelay: `${delay}ms` }}
          >
            <div
              className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${gradients[variant]} to-transparent`}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">
                  {label}
                </span>
                <div
                  className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg[variant]}`}
                >
                  {icon}
                </div>
              </div>
              <p className="text-xl font-heading font-bold tracking-tight truncate">{value}</p>
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

// Heuristic: is this metric a currency-like value or a large count?
function formatMetricValue(key: string, value: number): string {
  const lower = key.toLowerCase();
  // Monetary / cost metrics
  if (
    lower.includes("custo") ||
    lower.includes("cust") ||
    lower.includes("valor") ||
    lower.includes("receita") ||
    lower.includes("revenue") ||
    lower.includes("gasto") ||
    lower.includes("verba") ||
    lower.includes("cpm") ||
    lower.includes("cpc") ||
    lower.includes("cpa") ||
    lower.includes("cpp") ||
    lower.includes("roas")
  ) {
    // ROAS / ratios are plain numbers
    if (lower.includes("roas") || lower.includes("taxa") || lower.includes("ratio")) {
      return formatNumber(value);
    }
    return formatCurrency(value);
  }
  // Percentages
  if (lower.includes("%") || lower.includes("ctr") || lower.includes("taxa") || lower.includes("rate")) {
    return `${formatNumber(value)}%`;
  }
  // Default: integer count
  return formatNumber(value, value % 1 === 0 ? 0 : 2);
}

// Pick an icon for dynamic metric columns
function metricIcon(index: number) {
  const icons = [
    <Activity className="h-3.5 w-3.5" />,
    <Layers className="h-3.5 w-3.5" />,
    <TrendingUp className="h-3.5 w-3.5" />,
    <BarChart3 className="h-3.5 w-3.5" />,
    <Target className="h-3.5 w-3.5" />,
    <TrendingDown className="h-3.5 w-3.5" />,
    <Activity className="h-3.5 w-3.5" />,
    <Layers className="h-3.5 w-3.5" />,
    <TrendingUp className="h-3.5 w-3.5" />,
    <BarChart3 className="h-3.5 w-3.5" />,
    <Target className="h-3.5 w-3.5" />,
  ];
  return icons[index % icons.length];
}

function isSumMetric(key: string): boolean {
  const l = key.toLowerCase();
  return l === "impressões" || l === "cliques" || l === "lp view" || l === "checkouts";
}

export function TrafficSummaryCards({
  trafficSummary: ts,
  financialSummary: fs,
  trafficRows,
}: TrafficSummaryCardsProps) {
  const metricHeaders = getTrafficMetricHeaders(trafficRows);

  return (
    <div className="space-y-4">
      {/* === Section label === */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-2">
          Financeiro do Período
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* === Financial KPIs (from existing data) === */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Faturamento"
          value={formatCurrency(fs.totalGrossRevenue)}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          variant="default"
          delay={0}
          tooltip={`Faturamento Bruto no período\n${fs.daysCount} dias`}
        />
        <MetricCard
          label="Resultado Bruto"
          value={formatCurrency(fs.totalGrossResult)}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          variant={fs.totalGrossResult >= 0 ? "success" : "danger"}
          delay={40}
          tooltip={`Faturamento ${formatCurrency(fs.totalGrossRevenue)} − Taxas ${formatCurrency(fs.totalFees)}`}
        />
        <MetricCard
          label="Lucro Real"
          value={formatCurrency(fs.totalRealProfit)}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          variant={fs.totalRealProfit >= 0 ? "success" : "danger"}
          delay={80}
          tooltip={`Resultado Bruto ${formatCurrency(fs.totalGrossResult)} − Investimento ${formatCurrency(fs.totalInvestment)}`}
        />
        <MetricCard
          label="ROAS"
          value={formatNumber(fs.avgRoas)}
          icon={<Target className="h-3.5 w-3.5" />}
          variant={fs.avgRoas >= 1 ? "success" : "danger"}
          delay={120}
          tooltip={`Lucro Real ÷ Investimento\n= ${formatNumber(fs.avgRoas)}`}
        />
        <MetricCard
          label="Ticket Médio"
          value={formatCurrency(fs.avgTicket)}
          icon={<Receipt className="h-3.5 w-3.5" />}
          delay={160}
          tooltip={`Faturamento ÷ Clientes Únicos (${fs.totalUniqueBuyers})`}
        />
      </div>

      {/* === Section label === */}
      <div className="flex items-center gap-2 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-2">
          Investimento e Impostos Meta Ads
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* === Meta Ads Investment Cards === */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Investimento Anúncios"
          value={formatCurrency(ts.totalInvestimentoAnuncios)}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          variant="warning"
          delay={200}
          tooltip={`Total investido em anúncios Meta Ads no período\n${ts.daysCount} dias`}
        />
        <MetricCard
          label="Total c/ Imposto"
          value={formatCurrency(ts.totalInvestimentoComImposto)}
          icon={<Layers className="h-3.5 w-3.5" />}
          variant="warning"
          delay={240}
          tooltip={`Investimento + Imposto Meta Ads\nColu F da Planilha Base`}
        />
        <MetricCard
          label="Imposto Meta Ads"
          value={formatCurrency(ts.totalImpostoMetaAds)}
          icon={<Receipt className="h-3.5 w-3.5" />}
          variant="danger"
          delay={280}
          tooltip={`Imposto Meta Ads = (Inv. c/ Imposto) − (Inv. Anúncios)\n= ${formatCurrency(ts.totalInvestimentoComImposto)} − ${formatCurrency(ts.totalInvestimentoAnuncios)}`}
        />
      </div>

      {/* === Traffic Metrics (N–X dynamic) === */}
      {metricHeaders.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-2">
              Métricas de Tráfego
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {metricHeaders.map((header, idx) => {
              const isSum = isSumMetric(header);
              const val = isSum ? (ts.metricTotals[header] ?? 0) : (ts.metricAverages[header] ?? 0);
              
              return (
                <MetricCard
                  key={header}
                  label={header}
                  value={formatMetricValue(header, val)}
                  icon={metricIcon(idx)}
                  variant="info"
                  delay={320 + idx * 30}
                  tooltip={isSum 
                    ? `Soma do período: ${formatMetricValue(header, ts.metricTotals[header] ?? 0)}\nMédia diária: ${formatMetricValue(header, ts.metricAverages[header] ?? 0)}\n${ts.daysCount} dias`
                    : `Média do período: ${formatMetricValue(header, ts.metricAverages[header] ?? 0)}\nSoma total: ${formatMetricValue(header, ts.metricTotals[header] ?? 0)}\n${ts.daysCount} dias`}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
