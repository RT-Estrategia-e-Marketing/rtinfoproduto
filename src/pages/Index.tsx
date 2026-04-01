import { useState, useCallback } from "react";
import { toast } from "sonner";
import { SheetInputForm } from "@/components/SheetInputForm";
import { DashboardFilters } from "@/components/DashboardFilters";
import { SummaryCards } from "@/components/SummaryCards";
import { DailyTable } from "@/components/DailyTable";
import { SalesCharts } from "@/components/SalesCharts";
import {
  fetchSheetTabs,
  fetchSheetData,
  calculateSummary,
  exportToCSV,
  type SheetTab,
  type SalesRow,
} from "@/services/googleSheets";
import { BarChart3, Loader2 } from "lucide-react";

const Index = () => {
  const [sheetId, setSheetId] = useState<string>("");
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>("");
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [isLoadingTabs, setIsLoadingTabs] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnect = useCallback(async (id: string) => {
    setIsLoadingTabs(true);
    try {
      const detectedTabs = await fetchSheetTabs(id);
      setSheetId(id);
      setTabs(detectedTabs);
      setConnected(true);
      toast.success(`${detectedTabs.length} aba(s) detectada(s)!`);

      // Auto-select first tab and load data
      if (detectedTabs.length > 0) {
        const firstTab = detectedTabs[0];
        setSelectedTab(firstTab.name);
        await loadTabData(id, firstTab);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao conectar");
    } finally {
      setIsLoadingTabs(false);
    }
  }, []);

  const loadTabData = async (id: string, tab: SheetTab) => {
    setIsLoadingData(true);
    try {
      const data = await fetchSheetData(id, tab);
      setRows(data);
      if (data.length > 0) {
        const summary = calculateSummary(data);
        console.log(`Teste OK: ${data.length} linhas. Fat. Bruto Total: R$ ${summary.totalGrossRevenue.toFixed(2)}`);
        toast.success(`${data.length} registros carregados`);
      } else {
        toast.warning("Nenhum dado encontrado nesta aba");
      }
    } catch (error) {
      toast.error("Erro ao carregar dados da aba");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleTabChange = async (tabName: string) => {
    setSelectedTab(tabName);
    const tab = tabs.find((t) => t.name === tabName);
    if (tab) await loadTabData(sheetId, tab);
  };

  const handleExport = () => {
    if (rows.length > 0) {
      exportToCSV(rows, `infoproduto_${selectedTab.replace(/\s+/g, "_")}.csv`);
      toast.success("CSV exportado!");
    }
  };

  const handleRefresh = async () => {
    const tab = tabs.find((t) => t.name === selectedTab);
    if (tab) await loadTabData(sheetId, tab);
  };

  const summary = calculateSummary(rows);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold tracking-tight">Infoproduto Dashboard</h1>
            <p className="text-xs text-muted-foreground">Análise de vendas via Google Sheets</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Sheet Input */}
        {!connected ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            <div className="text-center space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse-glow">
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-heading font-bold">Conecte sua planilha</h2>
              <p className="text-muted-foreground max-w-md">
                Insira o ID da planilha pública do Google Sheets para visualizar seus dados de vendas.
              </p>
            </div>
            <SheetInputForm onSubmit={handleConnect} isLoading={isLoadingTabs} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connection info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Planilha conectada · <span className="font-mono text-xs">{sheetId.slice(0, 20)}...</span>
                </p>
              </div>
              <button
                onClick={() => { setConnected(false); setTabs([]); setRows([]); }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Trocar planilha
              </button>
            </div>

            {/* Filters */}
            <DashboardFilters
              tabs={tabs}
              selectedTab={selectedTab}
              onTabChange={handleTabChange}
              onExport={handleExport}
              onRefresh={handleRefresh}
              isLoading={isLoadingData}
            />

            {isLoadingData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <SummaryCards summary={summary} />

                {/* Charts */}
                <SalesCharts rows={rows} />

                {/* Daily Table */}
                <DailyTable rows={rows} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
