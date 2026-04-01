import { type SheetTab } from "@/services/googleSheets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Calendar, RefreshCw } from "lucide-react";

interface DashboardFiltersProps {
  tabs: SheetTab[];
  selectedTab: string;
  onTabChange: (tabName: string) => void;
  onExport: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function DashboardFilters({
  tabs,
  selectedTab,
  onTabChange,
  onExport,
  onRefresh,
  isLoading,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select value={selectedTab} onValueChange={onTabChange}>
          <SelectTrigger className="w-[200px] bg-card">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.name} value={tab.name}>
                {tab.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-1" />
          Exportar CSV
        </Button>
      </div>
    </div>
  );
}
