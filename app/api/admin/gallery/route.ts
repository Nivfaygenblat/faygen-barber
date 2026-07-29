import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

type GalleryUpdateItem = {
  id: string;
  title: string;
  image_url: string;
  sort_order: number;
  is_active?: boolean;
};

export async function GET(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  const { data, error } = await ctx.db
    .from("gallery_items")
    .select(
      `
      id,
      slot_key,
      title,
      image_url,
      sort_order,
      is_active,
      created_at,
      updated_at
      `
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to load gallery:", error);

    return NextResponse.json(
      { error: "לא ניתן לטעון את הגלריה" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: data || [],
  });
}

export async function PATCH(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const items: GalleryUpdateItem[] = Array.isArray(
      body.items
    )
      ? body.items
      : [];

    if (!items.length) {
      return NextResponse.json(
        { error: "לא התקבלו פריטים לשמירה" },
        { status: 400 }
      );
    }

    const normalizedItems = items.map((item, index) => ({
      id:
        typeof item.id === "string"
          ? item.id.trim()
          : "",
      title:
        typeof item.title === "string"
          ? item.title.trim()
          : "",
      image_url:
        typeof item.image_url === "string"
          ? item.image_url.trim()
          : "",
      sort_order:
        typeof item.sort_order === "number"
          ? item.sort_order
          : index + 1,
      is_active:
        typeof item.is_active === "boolean"
          ? item.is_active
          : true,
    }));

    const invalidItem = normalizedItems.some(
      (item) =>
        !item.id ||
        !item.title ||
        !item.image_url ||
        !Number.isInteger(item.sort_order)
    );

    if (invalidItem) {
      return NextResponse.json(
        { error: "אחד מפריטי הגלריה אינו תקין" },
        { status: 400 }
      );
    }

    const itemIds = normalizedItems.map(
      (item) => item.id
    );

    const { data: currentItems, error: loadError } =
      await ctx.db
        .from("gallery_items")
        .select(
          `
          id,
          title,
          image_url,
          sort_order,
          is_active
          `
        )
        .in("id", itemIds);

    if (loadError) {
      console.error(
        "Failed to load current gallery items:",
        loadError
      );

      return NextResponse.json(
        { error: "לא ניתן לטעון את מצב הגלריה" },
        { status: 500 }
      );
    }

    if (
      !currentItems ||
      currentItems.length !== normalizedItems.length
    ) {
      return NextResponse.json(
        { error: "חלק מפריטי הגלריה לא נמצאו" },
        { status: 404 }
      );
    }

    const currentById = new Map(
      currentItems.map((item) => [item.id, item])
    );

    const changedItems = normalizedItems.filter(
      (nextItem) => {
        const currentItem = currentById.get(
          nextItem.id
        );

        if (!currentItem) {
          return false;
        }

        return (
          currentItem.title !== nextItem.title ||
          currentItem.image_url !==
            nextItem.image_url ||
          currentItem.sort_order !==
            nextItem.sort_order ||
          currentItem.is_active !==
            nextItem.is_active
        );
      }
    );

    if (!changedItems.length) {
      return NextResponse.json({
        ok: true,
        message: "לא נמצאו שינויים",
      });
    }

    const versions = changedItems.map(
      (nextItem) => {
        const currentItem = currentById.get(
          nextItem.id
        )!;

        return {
          gallery_item_id: currentItem.id,
          title: currentItem.title,
          image_url: currentItem.image_url,
          sort_order: currentItem.sort_order,
          created_by: ctx.user.id,
        };
      }
    );

    const { error: historyError } = await ctx.db
      .from("gallery_versions")
      .insert(versions);

    if (historyError) {
      console.error(
        "Failed to save gallery history:",
        historyError
      );

      return NextResponse.json(
        { error: "לא ניתן לשמור היסטוריית שינויים" },
        { status: 500 }
      );
    }

    for (const item of changedItems) {
      const { error: updateError } = await ctx.db
        .from("gallery_items")
        .update({
          title: item.title,
          image_url: item.image_url,
          sort_order: item.sort_order,
          is_active: item.is_active,
        })
        .eq("id", item.id);

      if (updateError) {
        console.error(
          "Failed to update gallery item:",
          updateError
        );

        return NextResponse.json(
          { error: "לא ניתן לשמור את הגלריה" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      updated: changedItems.length,
    });
  } catch (error) {
    console.error(
      "Gallery update request failed:",
      error
    );

    return NextResponse.json(
      { error: "אירעה שגיאה בשמירת הגלריה" },
      { status: 500 }
    );
  }
}