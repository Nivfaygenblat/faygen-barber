import { createServerClient } from "@/lib/supabase/server";

type OpenSlotLike = {
  available_date: string;
  start_time: string;
};

type AppointmentLike = {
  appointment_date: string;
  start_time: string;
  end_time: string;
};

type BlockedTimeLike = {
  blocked_date: string;
  start_time: string | null;
  end_time: string | null;
  is_full_day: boolean | null;
};

type ServiceLike = {
  id: string;
  duration_minutes: number;
};

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function isPastSlot(date: string, time: string) {
  const slot = new Date(`${date}T${time}:00`);
  return slot.getTime() <= Date.now();
}

export async function getBookingAvailability({
  date,
  serviceName,
}: {
  date: string;
  serviceName: string;
}) {
  const db = createServerClient();
  if (!db) {
    return {
      date,
      slots: [] as string[],
      booked: [] as AppointmentLike[],
      serviceId: null as string | null,
      serviceDurationMinutes: 0,
    };
  }

  const { data: service } = await db
    .from("services")
    .select("id,duration_minutes")
    .eq("name", serviceName)
    .eq("is_active", true)
    .maybeSingle();

  if (!service) {
    return {
      date,
      slots: [] as string[],
      booked: [] as AppointmentLike[],
      serviceId: null as string | null,
      serviceDurationMinutes: 0,
    };
  }

  const { data: openSlots } = (await db
    .from("open_slots")
    .select("available_date,start_time")
    .eq("available_date", date)
    .order("start_time", { ascending: true })) as { data: OpenSlotLike[] | null };

  const { data: appointments } = (await db
    .from("appointments")
    .select("appointment_date,start_time,end_time")
    .eq("appointment_date", date)
    .not("status", "eq", "cancelled")) as { data: AppointmentLike[] | null };

  const { data: blockedRows } = (await db
    .from("blocked_times")
    .select("blocked_date,start_time,end_time,is_full_day")
    .eq("blocked_date", date)) as { data: BlockedTimeLike[] | null };

  const booked = appointments || [];
  const blocked = blockedRows || [];

  const slots = (openSlots || []).filter((slot) => {
    if (isPastSlot(slot.available_date, slot.start_time)) return false;

    const slotStart = toMinutes(slot.start_time);
    const slotEnd = slotStart + service.duration_minutes;

    const overlapsBlocked = blocked.some((block) => {
      if (block.is_full_day) return true;
      if (!block.start_time || !block.end_time) return false;
      const blockStart = toMinutes(block.start_time);
      const blockEnd = toMinutes(block.end_time);
      return overlaps(slotStart, slotEnd, blockStart, blockEnd);
    });

    if (overlapsBlocked) return false;

    const overlapsAppointment = booked.some((appointment) => {
      const appointmentStart = toMinutes(appointment.start_time);
      const appointmentEnd = toMinutes(appointment.end_time);
      return overlaps(slotStart, slotEnd, appointmentStart, appointmentEnd);
    });

    return !overlapsAppointment;
  }).map((slot) => slot.start_time);

  return {
    date,
    slots,
    booked,
    serviceId: service.id,
    serviceDurationMinutes: service.duration_minutes,
  };
}

export async function getAvailableDatesForMonth({
  month,
  serviceName,
}: {
  month: string;
  serviceName: string;
}) {
  const db = createServerClient();
  if (!db) {
    return {
      month,
      availableDates: [] as string[],
    };
  }

  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) {
    return {
      month,
      availableDates: [] as string[],
    };
  }

  const startDate = new Date(Date.UTC(year, monthIndex - 1, 1));
  const endDate = new Date(Date.UTC(year, monthIndex, 0));
  const from = `${year}-${String(monthIndex).padStart(2, "0")}-01`;
  const to = `${year}-${String(monthIndex).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`;

  const { data: service } = await db
    .from("services")
    .select("id,duration_minutes")
    .eq("name", serviceName)
    .eq("is_active", true)
    .maybeSingle();

  if (!service) {
    return {
      month,
      availableDates: [] as string[],
    };
  }

  const { data: openSlots } = (await db
    .from("open_slots")
    .select("available_date,start_time")
    .gte("available_date", from)
    .lte("available_date", to)
    .order("available_date", { ascending: true })
    .order("start_time", { ascending: true })) as { data: OpenSlotLike[] | null };

  const { data: appointments } = (await db
    .from("appointments")
    .select("appointment_date,start_time,end_time")
    .gte("appointment_date", from)
    .lte("appointment_date", to)
    .not("status", "eq", "cancelled")) as { data: AppointmentLike[] | null };

  const { data: blockedRows } = (await db
    .from("blocked_times")
    .select("blocked_date,start_time,end_time,is_full_day")
    .gte("blocked_date", from)
    .lte("blocked_date", to)) as { data: BlockedTimeLike[] | null };

  const blockedByDate = (blockedRows || []).reduce<Record<string, BlockedTimeLike[]>>((acc, block) => {
    acc[block.blocked_date] = [...(acc[block.blocked_date] || []), block];
    return acc;
  }, {});

  const bookedByDate = (appointments || []).reduce<Record<string, AppointmentLike[]>>((acc, appointment) => {
    acc[appointment.appointment_date] = [...(acc[appointment.appointment_date] || []), appointment];
    return acc;
  }, {});

  const availableDates = new Set<string>();
  const today = new Date();

  (openSlots || []).forEach((slot) => {
    const availableDate = slot.available_date;
    const slotDate = new Date(`${availableDate}T${slot.start_time}:00`);
    if (slotDate.getTime() <= today.getTime()) return;

    const slotStart = toMinutes(slot.start_time);
    const slotEnd = slotStart + service.duration_minutes;

    const blocked = blockedByDate[availableDate] || [];
    const overlapsBlocked = blocked.some((block) => {
      if (block.is_full_day) return true;
      if (!block.start_time || !block.end_time) return false;
      const blockStart = toMinutes(block.start_time);
      const blockEnd = toMinutes(block.end_time);
      return overlaps(slotStart, slotEnd, blockStart, blockEnd);
    });
    if (overlapsBlocked) return;

    const appointmentsForDate = bookedByDate[availableDate] || [];
    const overlapsAppointment = appointmentsForDate.some((appointment) => {
      const appointmentStart = toMinutes(appointment.start_time);
      const appointmentEnd = toMinutes(appointment.end_time);
      return overlaps(slotStart, slotEnd, appointmentStart, appointmentEnd);
    });
    if (overlapsAppointment) return;

    availableDates.add(availableDate);
  });

  return {
    month,
    availableDates: [...availableDates],
  };
}
