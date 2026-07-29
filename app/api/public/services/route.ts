import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const db = createServerClient();

    if (!db) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }

    const { data, error } = await db
      .from("services")
      .select(
        "id, name, description, price, duration_minutes, buffer_minutes, is_bookable, sort_order"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("GET /api/public/services:", error);

      return NextResponse.json(
        { error: "לא ניתן לטעון שירותים" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      services: data || [],
    });
  } catch (error) {
    console.error("GET /api/public/services unexpected error:", error);

    return NextResponse.json(
      { error: "אירעה שגיאה בלתי צפויה" },
      { status: 500 }
    );
  }
}