import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isIsraeliPhone } from "@/lib/validations";
import { getBookingAvailability } from "@/lib/booking/availability";

type BookingBody = {
  name?: string;
  phone?: string;
  service?: string;
  date?: string;
  time?: string;
  note?: string;
};

type CustomerAppointment = {
  appointment_date: string;
  status: string;
};

function normalizePhone(phone: string) {
  let normalized = phone.replace(/\D/g, "");

  if (normalized.startsWith("972")) {
    normalized = `0${normalized.slice(3)}`;
  }

  return normalized;
}

function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 10);
}

async function syncCustomer(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  customerName: string,
  customerPhone: string
) {
  /*
   * יוצרים את הלקוח אם הוא לא קיים.
   * אם הוא כבר קיים לפי מספר הטלפון, מעדכנים רק את שמו.
   */
  const { error: customerUpsertError } = await supabase
    .from("customers")
    .upsert(
      {
        full_name: customerName,
        phone: customerPhone,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "phone",
      }
    );

  if (customerUpsertError) {
    throw customerUpsertError;
  }

  /*
   * מחשבים מחדש את נתוני הלקוח מתוך טבלת התורים.
   * כך שינוי, אישור או ביטול תור לא גורמים לספירות שגויות.
   */
  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("appointment_date,status")
    .eq("customer_phone", customerPhone)
    .order("appointment_date", { ascending: true });

  if (appointmentsError) {
    throw appointmentsError;
  }

  const customerAppointments =
    (appointments as CustomerAppointment[] | null) || [];

  const today = getToday();

  const activeAppointments = customerAppointments.filter(
    (appointment) => appointment.status !== "cancelled"
  );

  const previousAppointments = activeAppointments.filter(
    (appointment) => appointment.appointment_date < today
  );

  const upcomingAppointments = activeAppointments.filter(
    (appointment) => appointment.appointment_date >= today
  );

  const firstVisit =
    activeAppointments.length > 0
      ? activeAppointments[0].appointment_date
      : null;

  const lastVisit =
    previousAppointments.length > 0
      ? previousAppointments[previousAppointments.length - 1].appointment_date
      : null;

  const nextVisit =
    upcomingAppointments.length > 0
      ? upcomingAppointments[0].appointment_date
      : null;

  const totalAppointments = customerAppointments.length;

  const completedAppointments = customerAppointments.filter(
    (appointment) => appointment.status === "completed"
  ).length;

  const cancelledAppointments = customerAppointments.filter(
    (appointment) => appointment.status === "cancelled"
  ).length;

  const pendingAppointments = customerAppointments.filter(
    (appointment) => appointment.status === "pending"
  ).length;

  const { error: customerUpdateError } = await supabase
    .from("customers")
    .update({
      full_name: customerName,
      first_visit: firstVisit,
      last_visit: lastVisit,
      next_visit: nextVisit,
      total_appointments: totalAppointments,
      completed_appointments: completedAppointments,
      cancelled_appointments: cancelledAppointments,
      pending_appointments: pendingAppointments,
      updated_at: new Date().toISOString(),
    })
    .eq("phone", customerPhone);

  if (customerUpdateError) {
    throw customerUpdateError;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BookingBody;

    const customerName = body.name?.trim() || "";
    const rawPhone = body.phone?.trim() || "";
    const customerPhone = normalizePhone(rawPhone);
    const serviceName = body.service?.trim() || "";
    const appointmentDate = body.date?.trim() || "";
    const appointmentTime = body.time?.trim() || "";
    const customerNote = body.note?.trim() || null;

    if (
      !customerName ||
      !serviceName ||
      !appointmentDate ||
      !appointmentTime ||
      !isIsraeliPhone(rawPhone)
    ) {
      return NextResponse.json(
        {
          error: "הפרטים שהוזנו אינם תקינים.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = createServerClient();

    if (!supabase) {
      return NextResponse.json(
        {
          error:
            "האתר מוכן, אך יש לחבר Supabase לפני קבלת תורים.",
        },
        {
          status: 503,
        }
      );
    }

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id,duration_minutes")
      .eq("name", serviceName)
      .eq("is_active", true)
      .maybeSingle();

    if (serviceError) {
      throw serviceError;
    }

    if (!service) {
      return NextResponse.json(
        {
          error: "השירות אינו זמין כרגע.",
        },
        {
          status: 400,
        }
      );
    }

    const availability = await getBookingAvailability({
      date: appointmentDate,
      serviceName,
    });

    if (!availability.slots.includes(appointmentTime)) {
      return NextResponse.json(
        {
          error:
            "השעה שנבחרה אינה זמינה יותר. נא לבחור שעה אחרת.",
        },
        {
          status: 409,
        }
      );
    }

    const startTime = appointmentTime;

    const endDate = new Date(`2000-01-01T${startTime}:00`);

    if (Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        {
          error: "שעת התור אינה תקינה.",
        },
        {
          status: 400,
        }
      );
    }

    endDate.setMinutes(
      endDate.getMinutes() + Number(service.duration_minutes)
    );

    const endTime = endDate.toTimeString().slice(0, 5);

    /*
     * יוצרים או מעדכנים את כרטיס הלקוח לפני ההזמנה.
     * אם ההזמנה לא תצליח, עדיין לא ייווצר כרטיס כפול,
     * מפני שמספר הטלפון מוגדר כייחודי.
     */
    await supabase.from("customers").upsert(
      {
        full_name: customerName,
        phone: customerPhone,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "phone",
      }
    );

    const { error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_note: customerNote,
        service_id: service.id,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
        status: "pending",
      });

    if (appointmentError) {
      /*
       * 23P01 הוא קוד של התנגשות באילוץ exclusion,
       * שמונע יצירת תורים חופפים.
       */
      if (
        appointmentError.code === "23P01" ||
        appointmentError.code === "23505"
      ) {
        return NextResponse.json(
          {
            error: "השעה כבר תפוסה.",
          },
          {
            status: 409,
          }
        );
      }

      throw appointmentError;
    }

    /*
     * ההזמנה כבר נשמרה בהצלחה.
     * כעת מסנכרנים את כל הסטטיסטיקות של הלקוח.
     *
     * אם הסנכרון נכשל, לא מחזירים ללקוח שגיאה,
     * כדי שהוא לא ינסה להזמין שוב וייצור תור כפול.
     */
    try {
      await syncCustomer(
        supabase,
        customerName,
        customerPhone
      );
    } catch (customerSyncError) {
      console.error(
        "Appointment saved, but customer synchronization failed:",
        customerSyncError
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("Appointment creation failed:", error);

    return NextResponse.json(
      {
        error: "אירעה שגיאה בשמירת התור. נסו שוב.",
      },
      {
        status: 500,
      }
    );
  }
}