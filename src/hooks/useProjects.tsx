import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Project {
  id: string;
  name: string;
  sheet_id: string;
  created_by: string;
  created_at: string;
}

export interface ProjectProduct {
  id: string;
  project_id: string;
  product_id: string;
  product_name: string;
  category: "principal" | "upsell" | "orderbump";
}

export function useProjects() {
  const { user, isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("projects").select("*").order("name");
    setProjects((data as Project[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(async (name: string, sheetId: string) => {
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, sheet_id: sheetId, created_by: user!.id })
      .select()
      .single();
    if (error) throw error;
    await loadProjects();
    return data as Project;
  }, [user, loadProjects]);

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    await loadProjects();
  }, [loadProjects]);

  const getProducts = useCallback(async (projectId: string): Promise<ProjectProduct[]> => {
    const { data } = await supabase.from("project_products").select("*").eq("project_id", projectId);
    return (data as ProjectProduct[]) || [];
  }, []);

  const saveProducts = useCallback(async (projectId: string, products: Omit<ProjectProduct, "id" | "project_id">[]) => {
    await supabase.from("project_products").delete().eq("project_id", projectId);
    if (products.length > 0) {
      const { error } = await supabase.from("project_products").insert(
        products.map((p) => ({ project_id: projectId, product_id: p.product_id, product_name: p.product_name, category: p.category }))
      );
      if (error) throw error;
    }
  }, []);

  const getUserAccess = useCallback(async (projectId: string) => {
    const { data } = await supabase.from("user_project_access").select("*").eq("project_id", projectId);
    return data || [];
  }, []);

  const setUserAccess = useCallback(async (userId: string, projectId: string) => {
    await supabase.from("user_project_access").insert({ user_id: userId, project_id: projectId });
  }, []);

  const removeUserAccess = useCallback(async (userId: string, projectId: string) => {
    await supabase.from("user_project_access").delete().eq("user_id", userId).eq("project_id", projectId);
  }, []);

  return { projects, loading, createProject, deleteProject, getProducts, saveProducts, getUserAccess, setUserAccess, removeUserAccess, reload: loadProjects };
}
