import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

type SlotStatus = "available" | "blocked" | "booked" | "closed";

type IncomingSlot = {
  id?: string;
  start_time?: string;
  end_time?: string;
  status?: SlotStatus;
};

type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
};

type ExistingSlot = {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  source: string | null;
};

function normalizeTime(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, 5);
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return -1;
  }

  return hours * 60 + minutes;
}

function periodsOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string
): boolean {
  const firstStartMinutes = timeToMinutes(firstStart);
  const firstEndMinutes = timeToMinutes(firstEnd);
  const secondStartMinutes = timeToMinutes(secondStart);
  const secondEndMinutes = timeToMinutes(secondEnd);

  if (
    firstStartMinutes < 0 ||
    firstEndMinutes < 0 ||
    secondStartMinutes < 0 ||
    secondEndMinutes < 0
  ) {
    return false;
  }

  return (
    firstStartMinutes < secondEndMinutes &&
    firstEndMinutes > secondStartMinutes
  );
}

function slotHasAppointment(
  slot: {
    start_time: string;
    end_time: string;
  },
  appointments: Appointment[]
): boolean {
  return appointments.some((appointment) =>
    periodsOverlap(
      slot.start_time,
      slot.end_time,
      normalizeTime(appointment.start_time),
      normalizeTime(appointment.end_time)
    )
  );
}

function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

export async function GET(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || "";

  if (!isValidDate(date)) {
    return NextResponse.json(
      { error: "חסר תאריך תקין" },
      { status: 400 }
    );
  }

  const [
    { data: slotsData, error: slotsError },
    { data: appointmentsData, error: appointmentsError },
  ] = await Promise.all([
    ctx.db
      .from("availability_slots")
      .select("*")
      .eq("slot_date", date)
      .order("start_time", { ascending: true }),

    ctx.db
      .from("appointments")
      .select("id,start_time,end_time,status")
      .eq("appointment_date", date)
      .neq("status", "cancelled"),
  ]);

  if (slotsError) {
    console.error("Load availability error:", slotsError);

    return NextResponse.json(
      { error: "לא ניתן לטעון זמינות" },
      { status: 500 }
    );
  }

  if (appointmentsError) {
    console.error(
      "Load appointments for availability error:",
      appointmentsError
    );

    return NextResponse.json(
      { error: "לא ניתן לבדוק תורים קיימים" },
      { status: 500 }
    );
  }

  const appointments: Appointment[] =
    (appointmentsData || []).map((appointment) => ({
      ...appointment,
      start_time: normalizeTime(appointment.start_time),
      end_time: normalizeTime(appointment.end_time),
    }));

  const slots = (slotsData || []).map((slot) => {
    const normalizedSlot = {
      ...slot,
      start_time: normalizeTime(slot.start_time),
      end_time: normalizeTime(slot.end_time),
    };

    return {
      ...normalizedSlot,
      status: slotHasAppointment(normalizedSlot, appointments)
        ? "booked"
        : normalizedSlot.status,
    };
  });

  return NextResponse.json({
    slots,
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
    const date = body?.date;
    const incomingSlots: IncomingSlot[] = body?.slots;

    if (!isValidDate(date) || !Array.isArray(incomingSlots)) {
      return NextResponse.json(
        { error: "נתוני לוח הזמנים אינם תקינים" },
        { status: 400 }
      );
    }

    if (incomingSlots.length === 0) {
      return NextResponse.json(
        { error: "יש ליצור לפחות שעה אחת לפני הפרסום" },
        { status: 400 }
      );
    }

    const normalizedSlots = incomingSlots.map((slot) => ({
      id:
        typeof slot.id === "string" && slot.id.trim()
          ? slot.id
          : undefined,
      start_time: normalizeTime(slot.start_time),
      end_time: normalizeTime(slot.end_time),
      status:
        slot.status === "blocked" || slot.status === "closed"
          ? slot.status
          : slot.status === "booked"
            ? "booked"
            : "available",
    }));

    for (const slot of normalizedSlots) {
      const startMinutes = timeToMinutes(slot.start_time);
      const endMinutes = timeToMinutes(slot.end_time);

      if (
        startMinutes < 0 ||
        endMinutes < 0 ||
        endMinutes <= startMinutes
      ) {
        return NextResponse.json(
          {
            error: `השעה ${slot.start_time || "שנבחרה"} אינה תקינה`,
          },
          { status: 400 }
        );
      }

      if (endMinutes - startMinutes !== 30) {
        return NextResponse.json(
          {
            error:
              "כל חלון זמן חייב להיות באורך של 30 דקות",
          },
          { status: 400 }
        );
      }
    }

    const uniqueStartTimes = new Set(
      normalizedSlots.map((slot) => slot.start_time)
    );

    if (uniqueStartTimes.size !== normalizedSlots.length) {
      return NextResponse.json(
        { error: "קיימות שעות כפולות בלוח הזמנים" },
        { status: 400 }
      );
    }

    const [
      { data: appointmentsData, error: appointmentsError },
      { data: existingSlotsData, error: existingSlotsError },
    ] = await Promise.all([
      ctx.db
        .from("appointments")
        .select("id,start_time,end_time,status")
        .eq("appointment_date", date)
        .neq("status", "cancelled"),

      ctx.db
        .from("availability_slots")
        .select("*")
        .eq("slot_date", date),
    ]);

    if (appointmentsError) {
      console.error(
        "Load appointments before save error:",
        appointmentsError
      );

      return NextResponse.json(
        { error: "לא ניתן לבדוק תורים קיימים" },
        { status: 500 }
      );
    }

    if (existingSlotsError) {
      console.error(
        "Load existing availability error:",
        existingSlotsError
      );

      return NextResponse.json(
        { error: "לא ניתן לטעון את לוח הזמנים הקיים" },
        { status: 500 }
      );
    }

    const appointments: Appointment[] =
      (appointmentsData || []).map((appointment) => ({
        ...appointment,
        start_time: normalizeTime(appointment.start_time),
        end_time: normalizeTime(appointment.end_time),
      }));

    /*
     * כל תור קיים חייב להישאר מכוסה על ידי לפחות חלון זמן אחד.
     * כך אי אפשר לקצר את יום העבודה ולגרום לתור קיים להיעלם.
     */
    const uncoveredAppointment = appointments.find(
      (appointment) =>
        !normalizedSlots.some((slot) =>
          periodsOverlap(
            slot.start_time,
            slot.end_time,
            appointment.start_time,
            appointment.end_time
          )
        )
    );

    if (uncoveredAppointment) {
      return NextResponse.json(
        {
          error:
            `לא ניתן להסיר את השעה ${uncoveredAppointment.start_time}, ` +
            "מכיוון שכבר קיים בה תור.",
        },
        { status: 409 }
      );
    }

    /*
     * השרת קובע בעצמו אילו שעות תפוסות.
     * גם אם הדפדפן שלח available או blocked, שעה עם תור תישמר כ-booked.
     */
    const rows = normalizedSlots.map((slot) => {
      const hasAppointment = slotHasAppointment(
        slot,
        appointments
      );

      return {
        slot_date: date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        status: hasAppointment
          ? "booked"
          : slot.status === "booked"
            ? "available"
            : slot.status,
        source: "manual",
        updated_at: new Date().toISOString(),
      };
    });

    /*
     * קודם מעדכנים ומוסיפים את השעות החדשות.
     * רק אם הפעולה הצליחה, מוחקים שעות ישנות שכבר אינן בלוח.
     */
    const { error: upsertError } = await ctx.db
      .from("availability_slots")
      .upsert(rows, {
        onConflict: "slot_date,start_time",
      });

    if (upsertError) {
      console.error("Save availability error:", upsertError);

      return NextResponse.json(
        { error: "לא ניתן לשמור את לוח הזמנים" },
        { status: 500 }
      );
    }

    const existingSlots: ExistingSlot[] =
      (existingSlotsData || []).map((slot) => ({
        ...slot,
        start_time: normalizeTime(slot.start_time),
        end_time: normalizeTime(slot.end_time),
      }));

    const staleSlotIds = existingSlots
      .filter(
        (existingSlot) =>
          !uniqueStartTimes.has(existingSlot.start_time) &&
          !slotHasAppointment(existingSlot, appointments)
      )
      .map((slot) => slot.id);

    if (staleSlotIds.length > 0) {
      const { error: deleteError } = await ctx.db
        .from("availability_slots")
        .delete()
        .in("id", staleSlotIds);

      if (deleteError) {
        console.error(
          "Delete stale availability slots error:",
          deleteError
        );

        return NextResponse.json(
          {
            error:
              "השעות החדשות נשמרו, אך לא ניתן היה להסיר חלק מהשעות הישנות",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: "שעות היום פורסמו בהצלחה",
    });
  } catch (error) {
    console.error("Save availability unexpected error:", error);

    return NextResponse.json(
      { error: "אירעה שגיאה בשמירת לוח הזמנים" },
      { status: 500 }
    );
  }
}