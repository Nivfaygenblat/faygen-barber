import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  req: Request,
  context: RouteContext
) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  try {
    const body = await req.json();

    const versionId =
      typeof body.version_id === "string"
        ? body.version_id.trim()
        : "";

    if (!versionId) {
      return NextResponse.json(
        { error: "חסרה גרסה לשחזור" },
        { status: 400 }
      );
    }

    const { data: version, error: versionError } =
      await ctx.db
        .from("gallery_versions")
        .select("*")
        .eq("id", versionId)
        .eq("gallery_item_id", id)
        .maybeSingle();

    if (versionError || !version) {
      return NextResponse.json(
        { error: "הגרסה לא נמצאה" },
        { status: 404 }
      );
    }

    const { data: current } = await ctx.db
      .from("gallery_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!current) {
      return NextResponse.json(
        { error: "התמונה לא נמצאה" },
        { status: 404 }
      );
    }

    // שומרים את המצב הנוכחי כהיסטוריה
    await ctx.db.from("gallery_versions").insert({
      gallery_item_id: current.id,
      title: current.title,
      image_url: current.image_url,
      sort_order: current.sort_order,
      created_by: ctx.user.id,
    });

    // משחזרים את הגרסה שנבחרה
    const { error: restoreError } =
      await ctx.db
        .from("gallery_items")
        .update({
          title: version.title,
          image_url: version.image_url,
          sort_order: version.sort_order,
        })
        .eq("id", id);

    if (restoreError) {
      return NextResponse.json(
        { error: "לא ניתן לשחזר את הגרסה" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "אירעה שגיאה" },
      { status: 500 }
    );
  }
}