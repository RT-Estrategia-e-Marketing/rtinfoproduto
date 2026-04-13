import { type TrafficRow, getTrafficMetricHeaders } from "@/services/trafficService";
import { formatCurrency, formatNumber } from "@/services/googleSheets";

interface TrafficDailyTableProps {
  rows: TrafficRow[];
}

// Same heuristic as TrafficSummaryCards — format metric values smartly
function formatMetricValue(key: string, value: number): string {
  const lower = key.toLowerCase();
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
    lower.includes("cpp")
  ) {
    return formatCurrency(value);
  }
  if (lower.includes("%") || lower.includes("ctr") || lower.includes("taxa")) {
    return `${formatNumber(value)}%`;
  }
  if (lower.includes("roas") || lower.includes("ratio")) {
    return formatNumber(value);
  }
  return formatNumber(value, value % 1 === 0 ? 0 : 2);
}

export function TrafficDailyTable({ rows }: TrafficDailyTableProps) {
  const metricHeaders = getTrafficMetricHeaders(rows);

  if (rows.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhum dado de tráfego disponível para o período selecionado.
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          Os dados de tráfego começam a partir de 07/08/2025.
        </p>
      </div>
    );
  }

  // Totals
  const totalInv = rows.reduce((s, r) => s + r.investimentoAnuncios, 0);
  const totalInvImposto = rows.reduce((s, r) => s + r.investimentoComImposto, 0);
  const totalImposto = rows.reduce((s, r) => s + r.impostoMetaAds, 0);
  const metricTotals: Record<string, number> = {};
  for (const h of metricHeaders) {
    metricTotals[h] = rows.reduce((s, r) => s + (r.metrics[h] ?? 0), 0);
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap sticky left-0 bg-muted/30 z-10">
                Data
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Inv. Anúncios
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Total c/ Imposto
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-destructive/70 uppercase tracking-wider whitespace-nowrap">
                Imposto Meta Ads
              </th>
              {metricHeaders.map((h) => (
                <th
                  key={h}
                  className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap max-w-[120px]"
                  title={h}
                >
                  <span className="block truncate max-w-[120px]">{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.date}
                className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${
                  idx % 2 === 0 ? "" : "bg-muted/10"
                }`}
              >
                <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-card z-10">
                  {row.date}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(row.investimentoAnuncios)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {formatCurrency(row.investimentoComImposto)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-destructive whitespace-nowrap">
                  {formatCurrency(row.impostoMetaAds)}
                </td>
                {metricHeaders.map((h) => (
                  <td
                    key={h}
                    className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
                  >
                    {formatMetricValue(h, row.metrics[h] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <td className="px-3 py-2.5 sticky left-0 bg-muted/40 z-10 text-xs text-muted-foreground uppercase tracking-wide">
                Total ({rows.length} dias)
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                {formatCurrency(totalInv)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                {formatCurrency(totalInvImposto)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-destructive whitespace-nowrap">
                {formatCurrency(totalImposto)}
              </td>
              {metricHeaders.map((h) => (
                <td
                  key={h}
                  className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap"
                >
                  {formatMetricValue(h, metricTotals[h] ?? 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-border/50 bg-muted/10">
        <p className="text-[10px] text-muted-foreground">
          Fonte: Aba "Planilha Base" · Dados a partir de 07/08/2025 · Imposto = Col F − Col E
        </p>
      </div>
    </div>
  );
}
