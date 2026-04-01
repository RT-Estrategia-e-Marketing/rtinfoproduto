import { type SalesRow, formatCurrency, formatNumber } from "@/services/googleSheets";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DailyTableProps {
  rows: SalesRow[];
}

export function DailyTable({ rows }: DailyTableProps) {
  if (rows.length === 0) {
    return (
      <div className="dashboard-section text-center py-12">
        <p className="text-muted-foreground">Nenhum dado para exibir neste período.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-section overflow-hidden">
      <h3 className="text-lg font-heading font-semibold mb-4">Visão Diária</h3>
      <div className="overflow-x-auto -mx-6">
        <div className="min-w-[900px] px-6">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs font-semibold">Data</TableHead>
                <TableHead className="text-xs font-semibold">Dia</TableHead>
                <TableHead className="text-xs font-semibold text-right">Tickets</TableHead>
                <TableHead className="text-xs font-semibold text-right">Fat. Bruto</TableHead>
                <TableHead className="text-xs font-semibold text-right">Taxas</TableHead>
                <TableHead className="text-xs font-semibold text-right">Res. Bruto</TableHead>
                <TableHead className="text-xs font-semibold text-right">Investimento</TableHead>
                <TableHead className="text-xs font-semibold text-right">Lucro Real</TableHead>
                <TableHead className="text-xs font-semibold text-right">ROAS</TableHead>
                <TableHead className="text-xs font-semibold text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i} className="border-border hover:bg-accent/50 transition-colors">
                  <TableCell className="text-sm font-medium">{row.date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.dayOfWeek}</TableCell>
                  <TableCell className="text-sm text-right">{row.tickets}</TableCell>
                  <TableCell className="text-sm text-right">{formatCurrency(row.grossRevenue)}</TableCell>
                  <TableCell className="text-sm text-right negative-value">{formatCurrency(row.fees)}</TableCell>
                  <TableCell className={`text-sm text-right ${row.grossResult >= 0 ? "positive-value" : "negative-value"}`}>
                    {formatCurrency(row.grossResult)}
                  </TableCell>
                  <TableCell className="text-sm text-right">{formatCurrency(row.investment)}</TableCell>
                  <TableCell className={`text-sm text-right font-semibold ${row.realProfit >= 0 ? "positive-value" : "negative-value"}`}>
                    {formatCurrency(row.realProfit)}
                  </TableCell>
                  <TableCell className={`text-sm text-right ${row.roas >= 2 ? "positive-value" : row.roas < 1 ? "negative-value" : ""}`}>
                    {formatNumber(row.roas)}
                  </TableCell>
                  <TableCell className="text-sm text-right">{formatCurrency(row.avgTicket)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
