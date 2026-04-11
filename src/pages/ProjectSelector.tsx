import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { BarChart3, Plus, FolderOpen, LogOut, Settings, Trash2, Loader2 } from "lucide-react";

export default function ProjectSelector() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { projects, loading, createProject, deleteProject } = useProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSheetId, setNewSheetId] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSheetId.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(newName.trim(), newSheetId.trim());
      toast.success(`Projeto "${project.name}" criado!`);
      navigate(`/project/${project.id}/setup`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar projeto");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir o projeto "${name}"?`)) return;
    try {
      await deleteProject(id);
      toast.success("Projeto excluído");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-heading font-bold tracking-tight">Meus Projetos</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/admin")}>
                <Settings className="h-3.5 w-3.5" /> Admin
              </Button>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {isAdmin && (
          <div className="flex justify-end">
            <Button onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo Projeto
            </Button>
          </div>
        )}

        {showCreate && isAdmin && (
          <Card className="bg-card border-border animate-fade-in">
            <CardHeader><CardTitle className="text-base">Criar Novo Projeto</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Nome do Projeto</label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Pizza na Prática" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">ID da Planilha Google Sheets</label>
                  <Input value={newSheetId} onChange={(e) => setNewSheetId(e.target.value)} placeholder="Cole o ID da planilha pública" required />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    {creating ? "Criando..." : "Criar e Configurar Produtos"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-heading font-bold">Nenhum projeto encontrado</h2>
            <p className="text-muted-foreground">
              {isAdmin ? "Crie um novo projeto para começar." : "Peça a um administrador para te dar acesso a um projeto."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <Card key={p.id} className="bg-card border-border hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate(`/project/${p.id}`)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sheet_id.slice(0, 20)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="sm" className="text-xs opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); navigate(`/project/${p.id}/setup`); }}>
                          Configurar
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
