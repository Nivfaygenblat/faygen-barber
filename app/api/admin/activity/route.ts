import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

export async function GET(req: Request) {
  const ctx = await getAdminContext(req);
  if (!ctx) {
    return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });
  }

  const { data, error } = await ctx.db.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) {
    return NextResponse.json({ error: "לא ניתן לטעון יומן פעילות" }, { status: 500 });
  }

  return NextResponse.json({ activity: data || [] });
}
