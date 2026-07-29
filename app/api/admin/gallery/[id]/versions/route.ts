import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
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
  const galleryItemId = id?.trim();

  if (!galleryItemId) {
    return NextResponse.json(
      { error: "מזהה תמונה חסר" },
      { status: 400 }
    );
  }

  const { data: item, error: itemError } =
    await ctx.db
      .from("gallery_items")
      .select(
        `
        id,
        title,
        image_url,
        sort_order,
        is_active,
        updated_at
        `
      )
      .eq("id", galleryItemId)
      .maybeSingle();

  if (itemError) {
    console.error(
      "Failed to load gallery item:",
      itemError
    );

    return NextResponse.json(
      { error: "לא ניתן לטעון את התמונה" },
      { status: 500 }
    );
  }

  if (!item) {
    return NextResponse.json(
      { error: "התמונה לא נמצאה" },
      { status: 404 }
    );
  }

  const { data: versions, error: versionsError } =
    await ctx.db
      .from("gallery_versions")
      .select(
        `
        id,
        gallery_item_id,
        title,
        image_url,
        sort_order,
        created_by,
        created_at
        `
      )
      .eq("gallery_item_id", galleryItemId)
      .order("created_at", { ascending: false });

  if (versionsError) {
    console.error(
      "Failed to load gallery versions:",
      versionsError
    );

    return NextResponse.json(
      { error: "לא ניתן לטעון את היסטוריית הגרסאות" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    item,
    versions: versions || [],
  });
}