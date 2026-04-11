import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, type ProjectProduct } from "@/hooks/useProjects";
import { fetchWebhookData } from "@/services/webhookParser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Package } from "lucide-react";

interface DetectedProduct {
  product_id: string;
  product_name: string;
  category: "principal" | "upsell" | "orderbump";
  count: number;
}

export default function ProjectSetup() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { projects, getProducts, saveProducts } = useProjects();
  const [products, setProducts] = useState<DetectedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const project = projects.find((p) => p.id === projectId);

  const loadData = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      // Fetch webhook data to detect products
      const webhookData = await fetchWebhookData(project.sheet_id);
      const productMap = new Map<string, { name: string; count: number }>();
      for (const sale of webhookData) {
        if (!sale.event.includes("APPROVED")) continue;
        const key = sale.productId || sale.productName;
        const existing = productMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          productMap.set(key, { name: sale.productName, count: 1 });
        }
      }

      // Load existing saved classifications
      const savedProducts = await getProducts(project.id);
      const savedMap = new Map(savedProducts.map((p) => [p.product_id, p.category]));

      const detected: DetectedProduct[] = Array.from(productMap.entries())
        .map(([id, info]) => ({
          product_id: id,
          product_name: info.name,
          category: savedMap.get(id) || ("orderbump" as const),
          count: info.count,
        }))
        .sort((a, b) => b.count - a.count);

      setProducts(detected);
    } catch (err: any) {
      toast.error("Erro ao carregar produtos: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  }, [project, getProducts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCategoryChange = (productId: string, category: "principal" | "upsell" | "orderbump") => {
    setProducts((prev) => prev.map((p) => (p.product_id === productId ? { ...p, category } : p)));
  };

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      await saveProducts(projectId, products.map((p) => ({ product_id: p.product_id, product_name: p.product_name, category: p.category })));
      toast.success("Classificações salvas!");
      navigate("/projects");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    navigate("/projects");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <h1 className="text-lg font-heading font-bold">Configurar Produtos — {project?.name || "..."}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5" />
              Classificação de Produtos
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              O sistema detectou os produtos da planilha. Classifique cada um como Principal, Upsell ou Order Bump.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Lendo produtos da planilha...</span>
              </div>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto encontrado na aba webhooks_pagamentos.</p>
            ) : (
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.product_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.product_name}</p>
                      <p className="text-[11px] text-muted-foreground">ID: {p.product_id} · {p.count} vendas</p>
                    </div>
                    <Select value={p.category} onValueChange={(v) => handleCategoryChange(p.product_id, v as any)}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="principal">🎯 Principal</SelectItem>
                        <SelectItem value="upsell">⬆️ Upsell</SelectItem>
                        <SelectItem value="orderbump">📦 Order Bump</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="pt-4">
                  <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Salvando..." : "Salvar Classificações"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
