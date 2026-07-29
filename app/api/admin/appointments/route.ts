import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

type AppointmentStatus = "pending" | "confirmed" | "cancelled";

type UpdateAppointmentBody = {
  id?: string;
  action?: "change_status" | "update_note" | "reschedule";
  status?: AppointmentStatus;
  internal_note?: string | null;
  appointment_date?: string;
  start_time?: string;
  end_time?: string;
};

const VALID_STATUSES: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
];

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidStatus(value: unknown): value is AppointmentStatus {
  return (
    typeof value === "string" &&
    VALID_STATUSES.includes(value as AppointmentStatus)
  );
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTime(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return "";
}

function timeToSeconds(value: string) {
  const [hours, minutes, seconds = 0] = value.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds)
  ) {
    return null;
  }

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function isOverlapError(error: {
  code?: string;
  message?: string;
  details?: string;
}) {
  return (
    error.code === "23P01" ||
    error.message?.toLowerCase().includes("no_overlapping_appointments") ||
    error.details?.toLowerCase().includes("conflicts with existing key")
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

  const date = normalizeText(searchParams.get("date"));
  const status = normalizeText(searchParams.get("status"));
  const serviceId = normalizeText(searchParams.get("service_id"));
  const search = normalizeText(searchParams.get("search"));

  if (date && !isValidDate(date)) {
    return NextResponse.json(
      { error: "התאריך שנשלח אינו תקין" },
      { status: 400 }
    );
  }

  if (status && !isValidStatus(status)) {
    return NextResponse.json(
      { error: "סטטוס התור אינו תקין" },
      { status: 400 }
    );
  }

  let query = ctx.db
    .from("appointments")
    .select(
      `
        id,
        customer_name,
        customer_phone,
        customer_note,
        service_id,
        appointment_date,
        start_time,
        end_time,
        status,
        internal_note,
        created_at,
        updated_at,
        services (
          id,
          name
        )
      `
    )
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (date) {
    query = query.eq("appointment_date", date);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (serviceId) {
    query = query.eq("service_id", serviceId);
  }

  if (search) {
    const safeSearch = search.replace(/[%_,]/g, "");

    query = query.or(
      `customer_name.ilike.%${safeSearch}%,customer_phone.ilike.%${safeSearch}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("GET /api/admin/appointments:", error);

    return NextResponse.json(
      { error: "לא ניתן לטעון את התורים" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    appointments: data || [],
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

  let body: UpdateAppointmentBody;

  try {
    body = (await req.json()) as UpdateAppointmentBody;
  } catch {
    return NextResponse.json(
      { error: "הבקשה אינה תקינה" },
      { status: 400 }
    );
  }

  const appointmentId = normalizeText(body.id);
  const action = body.action;

  if (!appointmentId) {
    return NextResponse.json(
      { error: "חסר מזהה תור" },
      { status: 400 }
    );
  }

  if (
    action !== "change_status" &&
    action !== "update_note" &&
    action !== "reschedule"
  ) {
    return NextResponse.json(
      { error: "סוג הפעולה אינו תקין" },
      { status: 400 }
    );
  }

  const { data: existingAppointment, error: existingError } =
    await ctx.db
      .from("appointments")
      .select(
        `
          id,
          customer_name,
          customer_phone,
          customer_note,
          service_id,
          appointment_date,
          start_time,
          end_time,
          status,
          internal_note,
          created_at,
          updated_at,
          services (
            id,
            name
          )
        `
      )
      .eq("id", appointmentId)
      .maybeSingle();

  if (existingError) {
    console.error("Read appointment error:", existingError);

    return NextResponse.json(
      { error: "לא ניתן לטעון את התור" },
      { status: 500 }
    );
  }

  if (!existingAppointment) {
    return NextResponse.json(
      { error: "התור לא נמצא" },
      { status: 404 }
    );
  }

  let updateData: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };

  let successMessage = "התור עודכן בהצלחה";

  if (action === "change_status") {
    if (!isValidStatus(body.status)) {
      return NextResponse.json(
        { error: "יש לבחור סטטוס תקין" },
        { status: 400 }
      );
    }

    updateData = {
      ...updateData,
      status: body.status,
    };

    if (body.internal_note !== undefined) {
      updateData.internal_note =
        normalizeText(body.internal_note) || null;
    }

    if (body.status === "confirmed") {
      successMessage = "התור אושר בהצלחה";
    } else if (body.status === "cancelled") {
      successMessage = "התור בוטל בהצלחה";
    } else {
      successMessage = "התור הוחזר לסטטוס ממתין";
    }
  }

  if (action === "update_note") {
    updateData = {
      ...updateData,
      internal_note: normalizeText(body.internal_note) || null,
    };

    successMessage = "ההערה הפנימית נשמרה";
  }

  if (action === "reschedule") {
    const appointmentDate = normalizeText(body.appointment_date);
    const startTime = normalizeTime(body.start_time);
    const endTime = normalizeTime(body.end_time);

    if (!isValidDate(appointmentDate)) {
      return NextResponse.json(
        { error: "יש לבחור תאריך תקין" },
        { status: 400 }
      );
    }

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: "יש לבחור שעת התחלה ושעת סיום תקינות" },
        { status: 400 }
      );
    }

    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);

    if (
      startSeconds === null ||
      endSeconds === null ||
      endSeconds <= startSeconds
    ) {
      return NextResponse.json(
        { error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" },
        { status: 400 }
      );
    }

    updateData = {
      ...updateData,
      appointment_date: appointmentDate,
      start_time: startTime,
      end_time: endTime,
    };

    if (body.internal_note !== undefined) {
      updateData.internal_note =
        normalizeText(body.internal_note) || null;
    }

    successMessage = "התור הועבר בהצלחה";
  }

  const { data: updatedAppointment, error: updateError } =
    await ctx.db
      .from("appointments")
      .update(updateData)
      .eq("id", appointmentId)
      .select(
        `
          id,
          customer_name,
          customer_phone,
          customer_note,
          service_id,
          appointment_date,
          start_time,
          end_time,
          status,
          internal_note,
          created_at,
          updated_at,
          services (
            id,
            name
          )
        `
      )
      .single();

  if (updateError) {
    console.error("PATCH /api/admin/appointments:", updateError);

    if (isOverlapError(updateError)) {
      return NextResponse.json(
        {
          error:
            "לא ניתן להעביר את התור לשעה הזאת כי כבר קיים תור חופף",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "לא ניתן לעדכן את התור" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: successMessage,
    appointment: updatedAppointment,
  });
}