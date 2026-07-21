import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isIsraeliPhone } from "@/lib/validations";
import { getBookingAvailability } from "@/lib/booking/availability";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || !body.date || !body.time || !isIsraeliPhone(body.phone || "")) {
      return NextResponse.json({ error: "הפרטים שהוזנו אינם תקינים." }, { status: 400 });
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "האתר מוכן, אך יש לחבר Supabase לפני קבלת תורים." }, { status: 503 });
    }

    const { data: service } = await supabase
      .from("services")
      .select("id,duration_minutes")
      .eq("name", body.service)
      .eq("is_active", true)
      .maybeSingle();

    if (!service) {
      return NextResponse.json({ error: "השירות אינו זמין כרגע." }, { status: 400 });
    }

    const availability = await getBookingAvailability({ date: body.date, serviceName: body.service });
    if (!availability.slots.includes(body.time)) {
      return NextResponse.json({ error: "השעה שנבחרה אינה זמינה יותר. נא לבחור שעה אחרת." }, { status: 409 });
    }

    const start = body.time;
    const end = new Date(`2000-01-01T${start}:00`);
    end.setMinutes(end.getMinutes() + service.duration_minutes);
    const endTime = end.toTimeString().slice(0, 5);

    const { error } = await supabase.from("appointments").insert({
      customer_name: body.name.trim(),
      customer_phone: body.phone.trim(),
      customer_note: body.note?.trim() || null,
      service_id: service.id,
      appointment_date: body.date,
      start_time: start,
      end_time: endTime,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "השעה כבר תפוסה." }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "אירעה שגיאה בשמירת התור. נסו שוב." }, { status: 500 });
  }
}
