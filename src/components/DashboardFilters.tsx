import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, CalendarIcon, RefreshCw, X } from "lucide-react";
import { format, startOfDay, subDays, startOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DashboardFiltersProps {
  months: { label: string; value: string }[];
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onExport: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

type QuickPreset = "hoje" | "ontem" | "7dias" | "mes" | "ano";

export function DashboardFilters({
  months,
  selectedMonth,
  onMonthChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onExport,
  onRefresh,
  isLoading,
}: DashboardFiltersProps) {
  const [activePreset, setActivePreset] = useState<QuickPreset | null>(null);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const applyPreset = (preset: QuickPreset) => {
    const today = startOfDay(new Date());
    setActivePreset(preset);
    onMonthChange("all");
    switch (preset) {
      case "hoje":
        onDateFromChange(today);
        onDateToChange(today);
        break;
      case "ontem": {
        const yesterday = subDays(today, 1);
        onDateFromChange(yesterday);
        onDateToChange(yesterday);
        break;
      }
      case "7dias":
        onDateFromChange(subDays(today, 6));
        onDateToChange(today);
        break;
      case "mes":
        onDateFromChange(startOfMonth(today));
        onDateToChange(today);
        break;
      case "ano":
        onDateFromChange(startOfYear(today));
        onDateToChange(today);
        break;
    }
  };

  const clearDates = () => {
    onDateFromChange(undefined);
    onDateToChange(undefined);
    setActivePreset(null);
  };

  const handleDateFromSelect = (date: Date | undefined) => {
    onDateFromChange(date);
    setActivePreset(null);
    setFromOpen(false);
    if (date && !dateTo) {
      setTimeout(() => setToOpen(true), 150);
    }
  };

  const handleDateToSelect = (date: Date | undefined) => {
    onDateToChange(date);
    setActivePreset(null);
    setToOpen(false);
  };

  const handleMonthChange = (value: string) => {
    onMonthChange(value);
    setActivePreset(null);
    if (value !== "all") {
      onDateFromChange(undefined);
      onDateToChange(undefined);
    }
  };

  const presets: { key: QuickPreset; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "ontem", label: "Ontem" },
    { key: "7dias", label: "Últimos 7 dias" },
    { key: "mes", label: "Mês Atual" },
    { key: "ano", label: "Este Ano" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <Button
            key={p.key}
            variant={activePreset === p.key ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset(p.key)}
            className={cn(
              "text-xs transition-all",
              activePreset === p.key && "shadow-md"
            )}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[180px] bg-card">
              <SelectValue placeholder="Todos os meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={handleDateFromSelect} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={handleDateToSelect}
                locale={ptBR}
                initialFocus
                className="p-3 pointer-events-auto"
                disabled={dateFrom ? (date) => date < dateFrom : undefined}
              />
            </PopoverContent>
          </Popover>

          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={clearDates} className="gap-1 text-xs text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
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
    </div>
  );
}
