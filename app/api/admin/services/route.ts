import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

export async function GET(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  const { data, error } = await ctx.db
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Load services error:", error);

    return NextResponse.json(
      { error: "לא ניתן לטעון שירותים" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    services: data || [],
  });
}

export async function POST(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const price = Number(body.price);
    const durationMinutes = Number(body.duration_minutes);

    if (!name) {
      return NextResponse.json(
        { error: "חובה להזין שם שירות" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: "המחיר אינו תקין" },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes <= 0
    ) {
      return NextResponse.json(
        { error: "משך השירות אינו תקין" },
        { status: 400 }
      );
    }

    const { error } = await ctx.db
      .from("services")
      .insert({
        name,
        description: description || null,
        price,
        duration_minutes: durationMinutes,
        is_active: true,
        is_bookable: true,
        sort_order: 0,
      });

    if (error) {
      console.error("Create service error:", error);

      return NextResponse.json(
        { error: "לא ניתן לשמור שירות" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "השירות נשמר בהצלחה",
    });
  } catch (error) {
    console.error("Create service unexpected error:", error);

    return NextResponse.json(
      { error: "אירעה שגיאה בשמירת השירות" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const id =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    if (!id) {
      return NextResponse.json(
        { error: "חסר מזהה שירות" },
        { status: 400 }
      );
    }

    const { error } = await ctx.db
      .from("services")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete service error:", error);

      return NextResponse.json(
        { error: "לא ניתן למחוק את השירות" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "השירות נמחק בהצלחה",
    });
  } catch (error) {
    console.error("Delete service unexpected error:", error);

    return NextResponse.json(
      { error: "אירעה שגיאה במחיקת השירות" },
      { status: 500 }
    );
  }
}