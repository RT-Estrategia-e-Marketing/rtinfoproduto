
-- User-project access mapping (created first so it can be referenced)
CREATE TABLE public.user_project_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);

ALTER TABLE public.user_project_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user_project_access"
  ON public.user_project_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can see own access"
  ON public.user_project_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on projects"
  ON public.projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view assigned projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_project_access
      WHERE user_id = auth.uid() AND project_id = projects.id
    )
  );

-- Add FK constraint now that projects exists
ALTER TABLE public.user_project_access 
  ADD CONSTRAINT user_project_access_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Product classifications per project
CREATE TABLE public.project_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'orderbump' CHECK (category IN ('principal', 'upsell', 'orderbump')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, product_id)
);

ALTER TABLE public.project_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage project_products"
  ON public.project_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view products of assigned projects"
  ON public.project_products FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_project_access
      WHERE user_id = auth.uid() AND project_id = project_products.project_id
    )
  );
