import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { SheetInputForm } from "@/components/SheetInputForm";
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
  fetchSheetTabs,
  fetchAllTabsData,
  calculateSummary,
  exportToCSV,
  getAvailableMonths,
  filterByMonth,
  type SheetTab,
  type SalesRow,
} from "@/services/googleSheets";
import { fetchWebhookData, type WebhookSale } from "@/services/webhookParser";
import { BarChart3, LayoutDashboard, LineChart, TableProperties, Lightbulb, MessageSquareText, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const [sheetId, setSheetId] = useState<string>("");
  const [allRows, setAllRows] = useState<SalesRow[]>([]);
  const [isLoadingTabs, setIsLoadingTabs] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [webhookData, setWebhookData] = useState<WebhookSale[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const handleConnect = useCallback(async (id: string) => {
    setIsLoadingTabs(true);
    try {
      const detectedTabs = await fetchSheetTabs(id);
      setSheetId(id);
      setTabs(detectedTabs);
      toast.success(`${detectedTabs.length} aba(s) detectada(s)! Carregando dados...`);

      setIsLoadingData(true);
      const data = await fetchAllTabsData(id, detectedTabs);
      setAllRows(data);
      setConnected(true);

      // Try to load webhook data
      try {
        const wData = await fetchWebhookData(id);
        setWebhookData(wData);
        if (wData.length > 0) {
          toast.success(`${wData.length} registros de webhooks carregados`);
        }
      } catch {
        // webhooks tab may not exist, that's ok
      }

      if (data.length > 0) {
        toast.success(`${data.length} registros carregados de todas as abas`);
      } else {
        toast.warning("Nenhum dado encontrado");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao conectar");
    } finally {
      setIsLoadingTabs(false);
      setIsLoadingData(false);
    }
  }, []);

  const availableMonths = useMemo(() => {
    return getAvailableMonths(allRows).map((m) => ({
      label: m.label,
      value: `${m.year}-${m.month}`,
      year: m.year,
      month: m.month,
    }));
  }, [allRows]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-").map(Number);
      rows = filterByMonth(rows, year, month);
    }
    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      rows = rows.filter((r) => r.dateObj >= start);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      rows = rows.filter((r) => r.dateObj <= end);
    }
    return rows;
  }, [allRows, selectedMonth, dateFrom, dateTo]);

  const summary = useMemo(() => calculateSummary(filteredRows), [filteredRows]);

  const handleExport = () => {
    if (filteredRows.length > 0) {
      exportToCSV(filteredRows, `infoproduto_export.csv`);
      toast.success("CSV exportado!");
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!sheetId || tabs.length === 0) return;
    setIsLoadingData(true);
    try {
      const data = await fetchAllTabsData(sheetId, tabs);
      setAllRows(data);
      toast.success(`${data.length} registros atualizados`);
    } catch {
      toast.error("Erro ao atualizar dados");
    } finally {
      setIsLoadingData(false);
    }
  }, [sheetId, tabs]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-heading font-bold tracking-tight">Infoproduto Dashboard</h1>
              <p className="text-[11px] text-muted-foreground">Análise de vendas via Google Sheets</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ChangelogModal />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!connected ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            <div className="text-center space-y-4">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto animate-pulse-glow">
                <BarChart3 className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-3xl font-heading font-bold">Conecte sua planilha</h2>
              <p className="text-muted-foreground max-w-md">
                Insira o ID da planilha pública do Google Sheets para visualizar seus dados de vendas com insights inteligentes.
              </p>
            </div>
            <SheetInputForm onSubmit={handleConnect} isLoading={isLoadingTabs || isLoadingData} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Planilha conectada · <span className="font-mono text-xs">{sheetId.slice(0, 16)}...</span>
                {" · "}{allRows.length} registros
              </p>
              <button
                onClick={() => { setConnected(false); setTabs([]); setAllRows([]); setSelectedMonth("all"); setDateFrom(undefined); setDateTo(undefined); }}
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                Trocar planilha
              </button>
            </div>

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
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Resumo
                  </TabsTrigger>
                  <TabsTrigger value="graficos" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <LineChart className="h-3.5 w-3.5" />
                    Gráficos
                  </TabsTrigger>
                  <TabsTrigger value="tabela" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <TableProperties className="h-3.5 w-3.5" />
                    Tabela
                  </TabsTrigger>
                  <TabsTrigger value="insights" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Insights
                  </TabsTrigger>
                  <TabsTrigger value="ia" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Chat IA
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="resumo" className="space-y-6 animate-fade-in">
                  <SummaryCards summary={summary} />
                  <SalesCharts rows={filteredRows} />
                </TabsContent>

                <TabsContent value="graficos" className="animate-fade-in">
                  <SalesCharts rows={filteredRows} />
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
              </Tabs>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
