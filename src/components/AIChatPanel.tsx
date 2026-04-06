import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type SalesRow, formatCurrency, formatNumber } from "@/services/googleSheets";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatPanelProps {
  rows: SalesRow[];
  allRows: SalesRow[];
}

const SUGGESTED_QUESTIONS = [
  "Qual dia da semana tem o maior ROAS?",
  "Qual foi o melhor mês em faturamento?",
  "Quais dias tiveram prejuízo e por quê?",
  "Me dê 3 insights para melhorar meu lucro",
  "Compare o desempenho dos últimos 2 meses",
];

function buildDataContext(rows: SalesRow[], allRows: SalesRow[]): string {
  const totalRows = rows.length;
  if (totalRows === 0) return "Nenhum dado disponível no período selecionado.";

  const totalGross = rows.reduce((s, r) => s + r.grossRevenue, 0);
  const totalFees = rows.reduce((s, r) => s + r.fees, 0);
  const totalGrossResult = rows.reduce((s, r) => s + r.grossResult, 0);
  const totalInvestment = rows.reduce((s, r) => s + r.investment, 0);
  const totalProfit = rows.reduce((s, r) => s + r.realProfit, 0);
  const totalTickets = rows.reduce((s, r) => s + r.tickets, 0);
  const avgRoas = totalInvestment > 0 ? totalGross / totalInvestment : 0;
  const avgTicket = totalTickets > 0 ? totalGross / totalTickets : 0;

  let context = `RESUMO DO PERÍODO FILTRADO (${totalRows} dias):
- Faturamento Bruto: R$ ${totalGross.toFixed(2)}
- Taxas: R$ ${totalFees.toFixed(2)}
- Resultado Bruto: R$ ${totalGrossResult.toFixed(2)}
- Investimento: R$ ${totalInvestment.toFixed(2)}
- Lucro Real: R$ ${totalProfit.toFixed(2)}
- Tickets: ${totalTickets}
- ROAS Médio: ${avgRoas.toFixed(2)}
- Ticket Médio: R$ ${avgTicket.toFixed(2)}

DADOS DIÁRIOS (${Math.min(totalRows, 60)} dias mais recentes):
Data | Dia | Tickets | Fat.Bruto | Taxas | Res.Bruto | Investimento | Lucro | ROAS | Ticket Médio\n`;

  const recentRows = rows.slice(-60);
  for (const r of recentRows) {
    context += `${r.date} | ${r.dayOfWeek} | ${r.tickets} | ${r.grossRevenue.toFixed(2)} | ${r.fees.toFixed(2)} | ${r.grossResult.toFixed(2)} | ${r.investment.toFixed(2)} | ${r.realProfit.toFixed(2)} | ${r.roas.toFixed(2)} | ${r.avgTicket.toFixed(2)}\n`;
  }

  // Add weekday aggregation
  const weekdayStats = new Map<string, { revenue: number; profit: number; roas: number; count: number; investment: number }>();
  for (const r of rows) {
    if (!r.dayOfWeek) continue;
    const existing = weekdayStats.get(r.dayOfWeek) || { revenue: 0, profit: 0, roas: 0, count: 0, investment: 0 };
    existing.revenue += r.grossRevenue;
    existing.profit += r.realProfit;
    existing.investment += r.investment;
    existing.count++;
    weekdayStats.set(r.dayOfWeek, existing);
  }

  context += `\nMÉDIA POR DIA DA SEMANA:\n`;
  for (const [day, stats] of weekdayStats) {
    const avgRevenue = stats.revenue / stats.count;
    const avgProfit = stats.profit / stats.count;
    const dayRoas = stats.investment > 0 ? stats.revenue / stats.investment : 0;
    context += `${day}: Média Fat. R$ ${avgRevenue.toFixed(2)} | Média Lucro R$ ${avgProfit.toFixed(2)} | ROAS ${dayRoas.toFixed(2)} | ${stats.count} dias\n`;
  }

  if (allRows.length > rows.length) {
    context += `\nNota: O período total tem ${allRows.length} dias. O filtro atual mostra ${rows.length} dias.`;
  }

  return context;
}

export function AIChatPanel({ rows, allRows }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = useCallback(async (question: string) => {
    const dataContext = buildDataContext(rows, allRows);

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat-data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ question, dataContext }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || `Erro ${resp.status}`);
    }

    if (!resp.body) throw new Error("Sem resposta do servidor");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  }, [rows, allRows]);

  const handleSend = useCallback(async (text?: string) => {
    const question = (text || input).trim();
    if (!question || isLoading) return;

    setInput("");
    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      await streamChat(question);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Erro desconhecido";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ **Erro:** ${errorMsg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, streamChat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="dashboard-section flex flex-col h-[600px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-sm">Assistente IA</h3>
            <p className="text-[11px] text-muted-foreground">Pergunte sobre seus dados de vendas</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            className="text-muted-foreground hover:text-foreground gap-1 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Faça perguntas sobre seus dados de vendas
              </p>
              <p className="text-xs text-muted-foreground/70">
                A IA analisa {rows.length} registros do período selecionado
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 border border-border"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-7 w-7 rounded-lg bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-foreground/70" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div className="bg-muted/50 border border-border rounded-xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 items-end border-t border-border pt-3">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre seus dados..."
          className="min-h-[44px] max-h-[120px] resize-none text-sm"
          disabled={isLoading}
        />
        <Button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="shrink-0 h-[44px] w-[44px]"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
