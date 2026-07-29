import { createServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<ReturnType<typeof createServerClient>>;

export type AdminProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
};

export type AdminContext = {
  db: SupabaseServerClient;
  user: { id: string };
  profile: AdminProfile;
  role: string;
};

export async function getAdminContext(req: Request, requiredRoles?: string[]) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const db = createServerClient();
  if (!db) return null;

  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,email,full_name,role,is_active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.is_active === false) return null;

  const role = (profile.role || "barber") as string;
  if (requiredRoles && !requiredRoles.includes(role)) return null;

  return {
    db,
    user: { id: userData.user.id },
    profile: profile as AdminProfile,
    role,
  } as AdminContext;
}

export async function hasPermission(req: Request, permissionKey: string) {
  const ctx = await getAdminContext(req);
  if (!ctx) return false;

  if (ctx.role === "owner") return true;

  const { data } = await ctx.db
    .from("user_permissions")
    .select("permission_key")
    .eq("user_id", ctx.profile.id)
    .eq("permission_key", permissionKey);

  return Boolean(data?.some((item) => item.permission_key === permissionKey));
}
