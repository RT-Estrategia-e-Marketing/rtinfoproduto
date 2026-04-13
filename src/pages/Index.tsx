import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, type ProjectProduct } from "@/hooks/useProjects";
import { DashboardFilters } from "@/components/DashboardFilters";
import { SummaryCards } from "@/components/SummaryCards";
import { DailyTable } from "@/components/DailyTable";
import { SalesCharts } from "@/components/SalesCharts";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AIChatPanel } from "@/components/AIChatPanel";
import { SalesAnalysisPanel } from "@/components/SalesAnalysisPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChangelogModal } from "@/components/ChangelogModal";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import {
  calculateSummary,
  exportToCSV,
  getAvailableMonths,
  filterByMonth,
  fetchInvestmentData,
  type SalesRow,
} from "@/services/googleSheets";
import { fetchWebhookData, type WebhookSale } from "@/services/webhookParser";
import { fetchOldData } from "@/services/oldDataParser";
import { getLocalDateKey } from "@/services/dateUtils";
import { BarChart3, LayoutDashboard, LineChart, TableProperties, Lightbulb, MessageSquareText, Zap, LogOut, Settings, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const WEBHOOK_CUTOFF = new Date(2026, 3, 1); // 01/04/2026
const DAY_LABELS_SHORT = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/** Fetch the last update timestamp from cell L4 of current month tab */
async function fetchTrafficUpdateTime(sheetId: string): Promise<string | null> {
  const now = new Date();
  const monthNames = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];
  const tabName = `${monthNames[now.getMonth()]} ${String(now.getFullYear()).slice(-2)}`;
  const query = encodeURIComponent("select L limit 4");
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&tq=${query}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const csv = await res.text();
    const lines = csv.split("\n").filter(Boolean);
    if (lines.length >= 4) {
      const val = lines[3].replace(/^"|"$/g, "").trim();
      if (val && val.length > 5) return val;
    }
    // Try line 2 (L2) as fallback
    if (lines.length >= 2) {
      const val = lines[1].replace(/^"|"$/g, "").trim();
      if (val && val.length > 5) return val;
    }
    return null;
  } catch {
    return null;
  }
}

/** Aggregate WebhookSale[] into SalesRow[] by day, injecting investment data */
function aggregateToSalesRows(sales: WebhookSale[], investMap: Map<string, number>): SalesRow[] {
  const dayMap = new Map<string, { dateObj: Date; dayOfWeek: string; approved: WebhookSale[]; refunded: WebhookSale[]; systemFees: WebhookSale[] }>();

  for (const sale of sales) {
    const key = getLocalDateKey(sale.dateObj);
    if (!dayMap.has(key)) {
      const d = new Date(sale.dateObj.getFullYear(), sale.dateObj.getMonth(), sale.dateObj.getDate());
      dayMap.set(key, { dateObj: d, dayOfWeek: DAY_LABELS_SHORT[d.getDay()], approved: [], refunded: [], systemFees: [] });
    }
    const entry = dayMap.get(key)!;
    const eventUpper = sale.event.toUpperCase();
    if (eventUpper.includes("APPROVED")) entry.approved.push(sale);
    else if (eventUpper.includes("REFUNDED")) entry.refunded.push(sale);
    else if (eventUpper === "SYSTEM_FEE") entry.systemFees.push(sale);
  }

  const rows: SalesRow[] = [];
  for (const [key, data] of dayMap) {
    const refundedTickets = data.refunded.length;
    const refundedValue = data.refunded.reduce((s, r) => s + Math.abs(r.originalPrice), 0);

    // Filter out approved items that were refunded (only for webhooks)
    const refundCounts = new Map<string, number>();
    for (const r of data.refunded) {
      if (r.source === "webhook") {
        const key = `${r.productId}_${r.buyerName.toLowerCase().trim()}`;
        refundCounts.set(key, (refundCounts.get(key) || 0) + 1);
      }
    }

    const netApproved = data.approved.reverse().filter((s) => {
      if (s.source === "old") return true;
      const key = `${s.productId}_${s.buyerName.toLowerCase().trim()}`;
      if (refundCounts.get(key)! > 0) {
        refundCounts.set(key, refundCounts.get(key)! - 1);
        return false;
      }
      return true;
    }).reverse();

    // Now all metrics are perfectly clean using netApproved
    const tickets = netApproved.length;
    const grossRevenue = netApproved.reduce((s, r) => s + r.originalPrice, 0);
    
    // grossResult sum + systemFees (like withdrawals, which inherently have negative commissionReceived, or we subtract their absolute value if they're positive)
    const baseResult = netApproved.reduce((s, r) => s + r.commissionReceived, 0);
    const systemFeesValue = data.systemFees.reduce((s, r) => s + Math.abs(r.commissionReceived || r.originalPrice), 0);
    
    // We strictly subtract systemFeesValue (ensure negative impact) if they are fees. 
    // Usually 'ajuste' can be positive but saque is definitely negative.
    // If we just mapped it to system fee, it's a deduction.
    const systemAdjustments = data.systemFees.reduce((s, r) => s + r.commissionReceived, 0);
    
    const grossResult = baseResult + systemAdjustments;
    const fees = grossRevenue - grossResult;
    
    const investment = investMap.get(key) || 0;
    const realProfit = grossResult - investment;
    const roas = investment > 0 ? realProfit / investment : 0;
    const netTickets = tickets > 0 ? tickets : 1;
    const avgTicket = grossRevenue > 0 ? grossRevenue / netTickets : 0;

    rows.push({
      date: `${String(data.dateObj.getDate()).padStart(2, "0")}/${String(data.dateObj.getMonth() + 1).padStart(2, "0")}/${data.dateObj.getFullYear()}`,
      dateObj: data.dateObj,
      dayOfWeek: data.dayOfWeek,
      tickets: Math.max(0, tickets),
      grossRevenue,
      fees,
      grossResult,
      investment,
      realProfit,
      roas,
      avgTicket,
      refundedTickets,
      refundedValue,
    });
  }

  rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  return rows;
}

const Index = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, getProducts } = useProjects();

  const project = projects.find((p) => p.id === projectId);

  const [allRows, setAllRows] = useState<SalesRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [webhookData, setWebhookData] = useState<WebhookSale[]>([]);
  const [productClassifications, setProductClassifications] = useState<ProjectProduct[]>([]);
  const [trafficUpdateTime, setTrafficUpdateTime] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const dataLoadedRef = useRef(false);
  const isInitialMount = useRef(true);

  const loadProjectData = useCallback(async (silent = false) => {
    if (!project) return;
    if (!silent) setIsLoadingData(true);
    try {
      const [trafficTime, wData, oldData, investMap, products] = await Promise.all([
        fetchTrafficUpdateTime(project.sheet_id),
        fetchWebhookData(project.sheet_id).catch(() => [] as WebhookSale[]),
        fetchOldData(project.sheet_id).catch(() => [] as WebhookSale[]),
        fetchInvestmentData(project.sheet_id),
        getProducts(project.id),
      ]);

      setTrafficUpdateTime(trafficTime);
      setProductClassifications(products);

      // Filter webhooks: only >= 01/04/2026
      const filteredWebhooks = wData.filter((s) => s.dateObj >= WEBHOOK_CUTOFF);

      // Merge: old data + filtered webhooks
      const merged = [...oldData, ...filteredWebhooks];

      // Deduplicate by date+event+productId+buyerName
      const seen = new Set<string>();
      const unique: WebhookSale[] = [];
      for (const sale of merged) {
        const key = `${sale.dateObj.getTime()}_${sale.event}_${sale.productId}_${sale.buyerName}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(sale);
        }
      }
      unique.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

      // Apply classifications
      if (products.length > 0) {
        const classMap = new Map(products.map((p) => [p.product_id, p.category]));
        for (const sale of unique) {
          const classified = classMap.get(sale.productId);
          if (classified) sale.productCategory = classified;
        }
      }

      setWebhookData(unique);

      // Aggregate into SalesRow for main dashboard
      const rows = aggregateToSalesRows(unique, investMap);
      setAllRows(rows);

      if (!silent && unique.length > 0) toast.success(`${unique.length} registros de vendas carregados`);
      dataLoadedRef.current = true;
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Erro ao conectar");
    } finally {
      if (!silent) setIsLoadingData(false);
    }
  }, [project, getProducts]);

  // Initial load
  useEffect(() => {
    if (!dataLoadedRef.current) {
      loadProjectData();
    }
  }, [loadProjectData]);

  // Auto-refresh on filter change (silent, debounced)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!dataLoadedRef.current) return;
    const timer = setTimeout(() => {
      loadProjectData(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [dateFrom, dateTo, selectedMonth, loadProjectData]);

  const handleRefresh = useCallback(async () => {
    dataLoadedRef.current = false;
    await loadProjectData();
  }, [loadProjectData]);

  const availableMonths = useMemo(() => {
    return getAvailableMonths(allRows).map((m) => ({
      label: m.label, value: `${m.year}-${m.month}`, year: m.year, month: m.month,
    }));
  }, [allRows]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-").map(Number);
      rows = filterByMonth(rows, year, month);
    }
    if (dateFrom) { const start = new Date(dateFrom); start.setHours(0, 0, 0, 0); rows = rows.filter((r) => r.dateObj >= start); }
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); rows = rows.filter((r) => r.dateObj <= end); }
    return rows;
  }, [allRows, selectedMonth, dateFrom, dateTo]);

  const filteredWebhookData = useMemo(() => {
    let data = webhookData;
    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-").map(Number);
      data = data.filter((s) => s.dateObj.getFullYear() === year && s.dateObj.getMonth() === month);
    }
    if (dateFrom) { const start = new Date(dateFrom); start.setHours(0, 0, 0, 0); data = data.filter((s) => s.dateObj >= start); }
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); data = data.filter((s) => s.dateObj <= end); }
    return data;
  }, [webhookData, selectedMonth, dateFrom, dateTo]);

  const summary = useMemo(() => calculateSummary(filteredRows), [filteredRows]);

  const handleExport = () => {
    if (filteredRows.length > 0) {
      exportToCSV(filteredRows, `${project?.name || "export"}.csv`);
      toast.success("CSV exportado!");
    }
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Projeto não encontrado</p>
          <Button onClick={() => navigate("/projects")}>Voltar aos Projetos</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-heading font-bold tracking-tight">{project.name}</h1>
              <p className="text-[11px] text-muted-foreground">
                {webhookData.length} vendas · {allRows.length} dias
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/admin")}>
                <Settings className="h-3.5 w-3.5" /> Admin
              </Button>
            )}
            <ChangelogModal />
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <DashboardFilters
            months={availableMonths}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onExport={handleExport}
            onRefresh={handleRefresh}
            isLoading={isLoadingData}
          />

          {isLoadingData ? (
            <DashboardSkeleton />
          ) : (
            <Tabs defaultValue="resumo" className="space-y-6">
              <TabsList className="bg-card border border-border p-1 h-auto flex-wrap">
                <TabsTrigger value="resumo" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <LayoutDashboard className="h-3.5 w-3.5" /> Resumo
                </TabsTrigger>
                <TabsTrigger value="graficos" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <LineChart className="h-3.5 w-3.5" /> Gráficos
                </TabsTrigger>
                <TabsTrigger value="tabela" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <TableProperties className="h-3.5 w-3.5" /> Tabela
                </TabsTrigger>
                <TabsTrigger value="insights" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Lightbulb className="h-3.5 w-3.5" /> Insights
                </TabsTrigger>
                <TabsTrigger value="ia" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <MessageSquareText className="h-3.5 w-3.5" /> Chat IA
                </TabsTrigger>
                {webhookData.length > 0 && (
                  <TabsTrigger value="analise" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Zap className="h-3.5 w-3.5" /> Análise Vendas
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="resumo" className="space-y-6 animate-fade-in">
                <SummaryCards summary={summary} trafficUpdateTime={trafficUpdateTime} />
                <SalesCharts rows={filteredRows} webhookData={filteredWebhookData} />
              </TabsContent>

              <TabsContent value="graficos" className="animate-fade-in">
                <SalesCharts rows={filteredRows} webhookData={filteredWebhookData} />
              </TabsContent>

              <TabsContent value="tabela" className="animate-fade-in">
                <DailyTable rows={filteredRows} />
              </TabsContent>

              <TabsContent value="insights" className="animate-fade-in">
                <InsightsPanel rows={filteredRows} allRows={allRows} />
              </TabsContent>

              <TabsContent value="ia" className="animate-fade-in">
                <AIChatPanel rows={filteredRows} allRows={allRows} />
              </TabsContent>

              {webhookData.length > 0 && (
                <TabsContent value="analise" className="animate-fade-in">
                  <SalesAnalysisPanel webhookData={filteredWebhookData} dailyRows={filteredRows} />
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
