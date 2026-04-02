import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: { type: "feature" | "fix" | "improvement"; text: string }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: "2.0",
    date: "02/04/2026",
    title: "Mega Atualização — Dashboard Pro",
    changes: [
      { type: "feature", text: "Painel de Insights Inteligentes com análise automática de tendências, melhor/pior dia, alertas de queda e crescimento" },
      { type: "feature", text: "Gráfico de Pizza — distribuição percentual de custos (Taxas, Investimento, Lucro)" },
      { type: "feature", text: "Gráfico de Área — evolução acumulada do faturamento ao longo do tempo" },
      { type: "feature", text: "Comparação mensal — variação % entre mês atual e anterior em todas as métricas" },
      { type: "feature", text: "Ranking dos melhores e piores dias por faturamento e lucro" },
      { type: "feature", text: "Projeção mensal — estimativa de faturamento e lucro baseada na média diária" },
      { type: "feature", text: "Diário de Bordo (Changelog) — modal no header para consultar atualizações" },
      { type: "improvement", text: "Visual premium com glassmorphism, gradientes e animações suaves" },
      { type: "improvement", text: "Navegação por abas no dashboard (Resumo, Gráficos, Tabela, Insights)" },
      { type: "improvement", text: "Loading skeletons durante carregamento dos dados" },
      { type: "improvement", text: "Cards com indicadores de tendência (↑ ↓) e cores semânticas" },
      { type: "improvement", text: "Tabela diária com paginação e busca" },
      { type: "improvement", text: "Layout responsivo aprimorado para mobile" },
      { type: "fix", text: "Tipografia refinada com hierarquia visual mais clara" },
    ],
  },
  {
    version: "1.0",
    date: "01/04/2026",
    title: "Versão Inicial",
    changes: [
      { type: "feature", text: "Conexão com Google Sheets público via ID" },
      { type: "feature", text: "Detecção automática de abas no formato MÊS ANO" },
      { type: "feature", text: "Dashboard com KPIs: Faturamento, Resultado, Investimento, Lucro, ROAS, Taxas, Tickets" },
      { type: "feature", text: "Filtro por mês e por período (data início/fim)" },
      { type: "feature", text: "Gráfico de barras Faturamento x Lucro x Investimento x Resultado" },
      { type: "feature", text: "Gráfico de linha ROAS diário" },
      { type: "feature", text: "Visão diária em tabela com totais" },
      { type: "feature", text: "Exportação CSV" },
      { type: "feature", text: "Modo claro e escuro" },
      { type: "feature", text: "Tooltips com fórmulas de cálculo nos cards" },
    ],
  },
];

const typeBadge = {
  feature: { label: "Novo", className: "bg-primary/15 text-primary border-primary/20" },
  fix: { label: "Correção", className: "bg-destructive/15 text-destructive border-destructive/20" },
  improvement: { label: "Melhoria", className: "bg-success/15 text-success border-success/20" },
};

export function ChangelogModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Novidades</span>
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-heading">
            <Sparkles className="h-5 w-5 text-primary" />
            Diário de Bordo
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-8">
            {changelog.map((entry) => (
              <div key={entry.version} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-sm font-heading font-bold px-3 py-1 bg-primary/10 text-primary border-primary/20">
                    v{entry.version}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <h4 className="font-heading font-semibold text-base">{entry.title}</h4>
                <ul className="space-y-2">
                  {entry.changes.map((change, i) => {
                    const badge = typeBadge[change.type];
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 mt-0.5 shrink-0 ${badge.className}`}>
                          {badge.label}
                        </Badge>
                        <span className="text-muted-foreground">{change.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
