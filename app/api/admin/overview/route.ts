import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

export async function GET(req: Request) {
  try {
    const ctx = await getAdminContext(req);

    if (!ctx) {
      return NextResponse.json(
        { error: "גישה נדחתה" },
        { status: 403 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const weekStart = startOfWeek.toISOString().slice(0, 10);

    const [
      todayResult,
      weeklyResult,
      customersResult,
      servicesResult,
      availabilityResult,
    ] = await Promise.all([
      ctx.db
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("appointment_date", today)
        .neq("status", "cancelled"),

      ctx.db
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("appointment_date", weekStart)
        .lte("appointment_date", today)
        .neq("status", "cancelled"),

      ctx.db
        .from("customers")
        .select("id", { count: "exact", head: true }),

      ctx.db
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      ctx.db
        .from("availability_slots")
        .select("id", { count: "exact", head: true })
        .eq("slot_date", today)
        .eq("status", "available"),
    ]);

    const firstError =
      todayResult.error ||
      weeklyResult.error ||
      customersResult.error ||
      servicesResult.error ||
      availabilityResult.error;

    if (firstError) {
      console.error("GET /api/admin/overview:", firstError);

      return NextResponse.json(
        { error: "לא ניתן לטעון את נתוני לוח הניהול" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      todayAppointments: todayResult.count ?? 0,
      weeklyAppointments: weeklyResult.count ?? 0,
      newCustomers: customersResult.count ?? 0,
      activeServices: servicesResult.count ?? 0,
      availableSlots: availabilityResult.count ?? 0,
      profile: ctx.profile,
    });
  } catch (error) {
    console.error("GET /api/admin/overview unexpected error:", error);

    return NextResponse.json(
      { error: "אירעה שגיאה בלתי צפויה" },
      { status: 500 }
    );
  }
}
