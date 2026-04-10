import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller } } = await adminClient.auth.getUser(token);
  if (!caller) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // GET - list users
  if (req.method === "GET") {
    const { data: { users }, error } = await adminClient.auth.admin.listUsers();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get roles
    const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
    const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));

    const mapped = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      role: roleMap.get(u.id) || "user",
      created_at: u.created_at,
    }));

    return new Response(JSON.stringify({ users: mapped }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // POST - create or delete user
  const body = await req.json();

  if (body.action === "delete") {
    const { error } = await adminClient.auth.admin.deleteUser(body.userId);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Create user
  const { email, password, role } = body;
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Assign role
  if (newUser?.user && role) {
    await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role });
  }

  return new Response(JSON.stringify({ success: true, userId: newUser?.user?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
