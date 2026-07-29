import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

export async function GET(req: Request) {
  const ctx = await getAdminContext(req);
  if (!ctx) {
    return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });
  }

  const { data, error } = await ctx.db.from("business_settings").select("*").order("created_at", { ascending: false }).limit(1);
  if (error) {
    return NextResponse.json({ error: "לא ניתן לטעון הגדרות" }, { status: 500 });
  }

  return NextResponse.json({ settings: data || [] });
}

export async function POST(req: Request) {
  const ctx = await getAdminContext(req);
  if (!ctx) {
    return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });
  }

  const body = await req.json();
  const { error } = await ctx.db.from("business_settings").upsert({
    id: "1",
    business_name: body.business_name || null,
    phone: body.phone || null,
    email: body.email || null,
    address: body.address || null,
    whatsapp: body.whatsapp || null,
    instagram_url: body.instagram_url || null,
    business_hours: body.business_hours || null,
    hero_title: body.hero_title || null,
    hero_subtitle: body.hero_subtitle || null,
    about_title: body.about_title || null,
    about_body: body.about_body || null,
    footer_text: body.footer_text || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: "לא ניתן לשמור הגדרות" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
