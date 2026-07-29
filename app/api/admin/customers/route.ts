import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

function normalizePhone(phone: string) {
  let normalized = phone.replace(/\D/g, "");

  if (normalized.startsWith("972")) {
    normalized = `0${normalized.slice(3)}`;
  }

  return normalized;
}

export async function GET(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  const { data, error } = await ctx.db
    .from("customers")
    .select(
      `
      id,
      full_name,
      phone,
      notes,
      first_visit,
      last_visit,
      next_visit,
      total_appointments,
      completed_appointments,
      cancelled_appointments,
      pending_appointments,
      total_spent,
      created_at,
      updated_at
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load customers:", error);

    return NextResponse.json(
      { error: "לא ניתן לטעון לקוחות" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    customers: data || [],
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

    const fullName =
      typeof body.full_name === "string"
        ? body.full_name.trim()
        : "";

    const rawPhone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    const phone = normalizePhone(rawPhone);

    const notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null;

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: "יש להזין שם מלא ומספר טלפון" },
        { status: 400 }
      );
    }

    const { error } = await ctx.db
      .from("customers")
      .upsert(
        {
          full_name: fullName,
          phone,
          notes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "phone",
        }
      );

    if (error) {
      console.error("Failed to save customer:", error);

      return NextResponse.json(
        { error: "לא ניתן לשמור לקוח" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("Customer request failed:", error);

    return NextResponse.json(
      { error: "אירעה שגיאה בשמירת הלקוח" },
      { status: 500 }
    );
  }
}