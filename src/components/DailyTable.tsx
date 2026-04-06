import { useState, useMemo } from "react";
import { type SalesRow, formatCurrency, formatNumber } from "@/services/googleSheets";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface DailyTableProps {
  rows: SalesRow[];
}

const PAGE_SIZE = 15;

type SortField = "date" | "tickets" | "grossRevenue" | "fees" | "grossResult" | "investment" | "realProfit" | "roas" | "avgTicket";
type SortDir = "asc" | "desc";

export function DailyTable({ rows }: DailyTableProps) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.date.includes(q) || r.dayOfWeek.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: number, vb: number;
      if (sortField === "date") {
        va = a.dateObj.getTime(); vb = b.dateObj.getTime();
      } else {
        va = a[sortField]; vb = b[sortField];
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totals = useMemo(() => ({
    tickets: rows.reduce((s, r) => s + r.tickets, 0),
    grossRevenue: rows.reduce((s, r) => s + r.grossRevenue, 0),
    fees: rows.reduce((s, r) => s + r.fees, 0),
    grossResult: rows.reduce((s, r) => s + r.grossResult, 0),
    investment: rows.reduce((s, r) => s + r.investment, 0),
    realProfit: rows.reduce((s, r) => s + r.realProfit, 0),
    roas: rows.length > 0 ? rows.reduce((s, r) => s + r.realProfit, 0) / rows.reduce((s, r) => s + r.investment, 0) : 0,
    avgTicket: rows.length > 0 ? rows.reduce((s, r) => s + r.grossRevenue, 0) / rows.reduce((s, r) => s + r.tickets, 0) : 0,
  }), [rows]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (rows.length === 0) {
    return (
      <div className="dashboard-section text-center py-12">
        <p className="text-muted-foreground">Nenhum dado para exibir neste período.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-section overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider">Visão Diária</h3>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar data ou dia..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>
      <div className="overflow-x-auto -mx-6">
        <div className="min-w-[900px] px-6">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs font-semibold cursor-pointer select-none" onClick={() => handleSort("date")}>
                  <span className="flex items-center">Data <SortIcon field="date" /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold">Dia</TableHead>
                <TableHead className="text-xs font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("tickets")}>
                  <span className="flex items-center justify-end">Tickets <SortIcon field="tickets" /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("grossRevenue")}>
                  <span className="flex items-center justify-end">Fat. Bruto <SortIcon field="grossRevenue" /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("fees")}>
                  <span className="flex items-center justify-end">Taxas <SortIcon field="fees" /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("grossResult")}>
                  <span className="flex items-center justify-end">Res. Bruto <SortIcon field="grossResult" /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("investment")}>
                  <span className="flex items-center justify-end">Investimento <SortIcon field="investment" /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("realProfit")}>
                  <span className="flex items-center justify-end">Lucro Real <SortIcon field="realProfit" /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("roas")}>
                  <span className="flex items-center justify-end">ROAS <SortIcon field="roas" /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("avgTicket")}>
                  <span className="flex items-center justify-end">Ticket Médio <SortIcon field="avgTicket" /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row, i) => (
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
                  <TableCell className={`text-sm text-right ${row.roas >= 0 ? "positive-value" : "negative-value"}`}>
                    {formatNumber(row.roas)}
                  </TableCell>
                  <TableCell className="text-sm text-right">{formatCurrency(row.avgTicket)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="border-border bg-muted/50 font-semibold">
                <TableCell className="text-sm">Total ({rows.length} dias)</TableCell>
                <TableCell />
                <TableCell className="text-sm text-right">{totals.tickets}</TableCell>
                <TableCell className="text-sm text-right">{formatCurrency(totals.grossRevenue)}</TableCell>
                <TableCell className="text-sm text-right negative-value">{formatCurrency(totals.fees)}</TableCell>
                <TableCell className={`text-sm text-right ${totals.grossResult >= 0 ? "positive-value" : "negative-value"}`}>
                  {formatCurrency(totals.grossResult)}
                </TableCell>
                <TableCell className="text-sm text-right">{formatCurrency(totals.investment)}</TableCell>
                <TableCell className={`text-sm text-right ${totals.realProfit >= 0 ? "positive-value" : "negative-value"}`}>
                  {formatCurrency(totals.realProfit)}
                </TableCell>
                <TableCell className="text-sm text-right">{formatNumber(isFinite(totals.roas) ? totals.roas : 0)}</TableCell>
                <TableCell className="text-sm text-right">{formatCurrency(isFinite(totals.avgTicket) ? totals.avgTicket : 0)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages} · {sorted.length} registros
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
