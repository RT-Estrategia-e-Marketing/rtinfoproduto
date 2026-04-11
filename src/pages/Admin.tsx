import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Trash2, Shield, User, FolderOpen } from "lucide-react";

interface UserEntry {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { projects, getUserAccess, setUserAccess, removeUserAccess } = useProjects();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [creating, setCreating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userProjectIds, setUserProjectIds] = useState<string[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, authLoading, navigate]);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("admin-users", { method: "GET" });
    if (!error && data?.users) setUsers(data.users);
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        method: "POST",
        body: { email: newEmail, password: newPassword, role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Usuário ${newEmail} criado!`);
      setNewEmail(""); setNewPassword(""); setNewRole("user");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Remover o usuário ${email}?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        method: "POST",
        body: { action: "delete", userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Usuário ${email} removido`);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  };

  const handleSelectUser = async (userId: string) => {
    if (selectedUserId === userId) { setSelectedUserId(null); return; }
    setSelectedUserId(userId);
    setLoadingAccess(true);
    try {
      // Load all project access for this user across all projects
      const { data } = await supabase.from("user_project_access").select("project_id").eq("user_id", userId);
      setUserProjectIds((data || []).map((d: any) => d.project_id));
    } catch {
      setUserProjectIds([]);
    } finally {
      setLoadingAccess(false);
    }
  };

  const handleToggleProjectAccess = async (projectId: string, checked: boolean) => {
    if (!selectedUserId) return;
    try {
      if (checked) {
        await setUserAccess(selectedUserId, projectId);
        setUserProjectIds((prev) => [...prev, projectId]);
      } else {
        await removeUserAccess(selectedUserId, projectId);
        setUserProjectIds((prev) => prev.filter((id) => id !== projectId));
      }
      toast.success("Acesso atualizado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar acesso");
    }
  };

  if (authLoading) return null;

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <h1 className="text-lg font-heading font-bold">Painel Administrativo</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-2xl">
        {/* Create User */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Criar Novo Usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Email</label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Senha</label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="space-y-1 flex-1">
                  <label className="text-xs text-muted-foreground">Papel</label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={creating} className="gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  {creating ? "Criando..." : "Criar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-heading">Usuários Cadastrados</CardTitle>
            <p className="text-xs text-muted-foreground">Clique em um usuário para gerenciar o acesso aos projetos</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUserId === u.id ? "bg-primary/10 border border-primary/30" : "bg-muted/50 hover:bg-muted"
                    }`}
                    onClick={() => u.role !== "admin" && handleSelectUser(u.id)}
                  >
                    {u.role === "admin" ? <Shield className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {u.role === "admin" ? "Admin (acesso total)" : "Usuário"} · {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {u.id !== user?.id && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(u.id, u.email); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Project Access Panel */}
                  {selectedUserId === u.id && u.role !== "admin" && (
                    <div className="ml-8 mt-2 p-3 rounded-lg bg-muted/30 border border-border space-y-2 animate-fade-in">
                      <div className="flex items-center gap-2 mb-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold">Projetos acessíveis por {u.email}</span>
                      </div>
                      {loadingAccess ? (
                        <p className="text-xs text-muted-foreground">Carregando...</p>
                      ) : projects.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum projeto criado ainda</p>
                      ) : (
                        projects.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={userProjectIds.includes(p.id)}
                              onCheckedChange={(checked) => handleToggleProjectAccess(p.id, !!checked)}
                            />
                            <span className="text-sm">{p.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando usuários...</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
