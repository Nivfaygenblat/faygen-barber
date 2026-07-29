import { createServerClient } from "@/lib/supabase/server";

type AvailabilitySlotLike = {
  slot_date: string;
  start_time: string;
  end_time: string;
  status: "available" | "blocked" | "booked" | "closed";
};

type AppointmentLike = {
  appointment_date: string;
  start_time: string;
  end_time: string;
  status?: string;
};

type ServiceLike = {
  id: string;
  duration_minutes: number;
};

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function toMinutes(value: string) {
  const [hours, minutes] = normalizeTime(value)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function overlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number
) {
  return startA < endB && endA > startB;
}

function isPastSlot(date: string, time: string) {
  const slotDate = new Date(`${date}T${normalizeTime(time)}:00`);

  return slotDate.getTime() <= Date.now();
}

/**
 * בודק שיש מספיק חלונות רצופים של 30 דקות
 * כדי להכיל את כל משך השירות.
 *
 * לדוגמה:
 * שירות של 60 דקות שמתחיל ב־09:00
 * דורש שגם 09:00–09:30 וגם 09:30–10:00 יהיו פנויים.
 */
function hasContinuousAvailability({
  candidateStartTime,
  durationMinutes,
  slots,
}: {
  candidateStartTime: string;
  durationMinutes: number;
  slots: AvailabilitySlotLike[];
}) {
  const requestedStart = toMinutes(candidateStartTime);
  const requestedEnd = requestedStart + durationMinutes;

  const sortedSlots = [...slots].sort(
    (a, b) => toMinutes(a.start_time) - toMinutes(b.start_time)
  );

  let coveredUntil = requestedStart;

  for (const slot of sortedSlots) {
    if (slot.status !== "available") {
      continue;
    }

    const slotStart = toMinutes(slot.start_time);
    const slotEnd = toMinutes(slot.end_time);

    if (slotEnd <= coveredUntil) {
      continue;
    }

    /*
     * אם יש רווח בין סוף החלון הקודם לחלון הנוכחי,
     * אין רצף מלא עבור השירות.
     */
    if (slotStart > coveredUntil) {
      break;
    }

    if (slotStart <= coveredUntil && slotEnd > coveredUntil) {
      coveredUntil = slotEnd;
    }

    if (coveredUntil >= requestedEnd) {
      return true;
    }
  }

  return false;
}

function overlapsExistingAppointment({
  startTime,
  durationMinutes,
  appointments,
}: {
  startTime: string;
  durationMinutes: number;
  appointments: AppointmentLike[];
}) {
  const requestedStart = toMinutes(startTime);
  const requestedEnd = requestedStart + durationMinutes;

  return appointments.some((appointment) => {
    const appointmentStart = toMinutes(appointment.start_time);
    const appointmentEnd = toMinutes(appointment.end_time);

    return overlaps(
      requestedStart,
      requestedEnd,
      appointmentStart,
      appointmentEnd
    );
  });
}

async function getService(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  serviceName: string
): Promise<ServiceLike | null> {
  const { data, error } = await db
    .from("services")
    .select("id,duration_minutes")
    .eq("name", serviceName)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Load booking service error:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    duration_minutes: Number(data.duration_minutes),
  };
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

  const service = await getService(db, serviceName);

  if (!service || service.duration_minutes <= 0) {
    return {
      date,
      slots: [] as string[],
      booked: [] as AppointmentLike[],
      serviceId: null as string | null,
      serviceDurationMinutes: 0,
    };
  }

  const [
    { data: availabilityData, error: availabilityError },
    { data: appointmentsData, error: appointmentsError },
  ] = await Promise.all([
    db
      .from("availability_slots")
      .select("slot_date,start_time,end_time,status")
      .eq("slot_date", date)
      .order("start_time", { ascending: true }),

    db
      .from("appointments")
      .select("appointment_date,start_time,end_time,status")
      .eq("appointment_date", date)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true }),
  ]);

  if (availabilityError) {
    console.error(
      "Load public availability slots error:",
      availabilityError
    );

    return {
      date,
      slots: [] as string[],
      booked: [] as AppointmentLike[],
      serviceId: service.id,
      serviceDurationMinutes: service.duration_minutes,
    };
  }

  if (appointmentsError) {
    console.error(
      "Load public appointments error:",
      appointmentsError
    );

    return {
      date,
      slots: [] as string[],
      booked: [] as AppointmentLike[],
      serviceId: service.id,
      serviceDurationMinutes: service.duration_minutes,
    };
  }

  const availabilitySlots: AvailabilitySlotLike[] = (
    availabilityData || []
  ).map((slot) => ({
    slot_date: slot.slot_date,
    start_time: normalizeTime(slot.start_time),
    end_time: normalizeTime(slot.end_time),
    status: slot.status,
  }));

  const booked: AppointmentLike[] = (appointmentsData || []).map(
    (appointment) => ({
      appointment_date: appointment.appointment_date,
      start_time: normalizeTime(appointment.start_time),
      end_time: normalizeTime(appointment.end_time),
      status: appointment.status,
    })
  );

  /*
   * רק חלונות שהמנהל פרסם כ־available
   * יכולים לשמש כשעת התחלה אפשרית.
   */
  const slots = availabilitySlots
    .filter((slot) => slot.status === "available")
    .filter((slot) => !isPastSlot(date, slot.start_time))
    .filter((slot) =>
      hasContinuousAvailability({
        candidateStartTime: slot.start_time,
        durationMinutes: service.duration_minutes,
        slots: availabilitySlots,
      })
    )
    .filter(
      (slot) =>
        !overlapsExistingAppointment({
          startTime: slot.start_time,
          durationMinutes: service.duration_minutes,
          appointments: booked,
        })
    )
    .map((slot) => normalizeTime(slot.start_time));

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

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    monthIndex < 1 ||
    monthIndex > 12
  ) {
    return {
      month,
      availableDates: [] as string[],
    };
  }

  const endDate = new Date(Date.UTC(year, monthIndex, 0));

  const from =
    `${year}-` +
    `${String(monthIndex).padStart(2, "0")}-01`;

  const to =
    `${year}-` +
    `${String(monthIndex).padStart(2, "0")}-` +
    `${String(endDate.getUTCDate()).padStart(2, "0")}`;

  const service = await getService(db, serviceName);

  if (!service || service.duration_minutes <= 0) {
    return {
      month,
      availableDates: [] as string[],
    };
  }

  const [
    { data: availabilityData, error: availabilityError },
    { data: appointmentsData, error: appointmentsError },
  ] = await Promise.all([
    db
      .from("availability_slots")
      .select("slot_date,start_time,end_time,status")
      .gte("slot_date", from)
      .lte("slot_date", to)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true }),

    db
      .from("appointments")
      .select("appointment_date,start_time,end_time,status")
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .neq("status", "cancelled")
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  if (availabilityError) {
    console.error(
      "Load monthly availability error:",
      availabilityError
    );

    return {
      month,
      availableDates: [] as string[],
    };
  }

  if (appointmentsError) {
    console.error(
      "Load monthly appointments error:",
      appointmentsError
    );

    return {
      month,
      availableDates: [] as string[],
    };
  }

  const availabilityByDate = (
    (availabilityData || []) as AvailabilitySlotLike[]
  ).reduce<Record<string, AvailabilitySlotLike[]>>(
    (result, slot) => {
      const normalizedSlot: AvailabilitySlotLike = {
        slot_date: slot.slot_date,
        start_time: normalizeTime(slot.start_time),
        end_time: normalizeTime(slot.end_time),
        status: slot.status,
      };

      result[slot.slot_date] = [
        ...(result[slot.slot_date] || []),
        normalizedSlot,
      ];

      return result;
    },
    {}
  );

  const appointmentsByDate = (
    (appointmentsData || []) as AppointmentLike[]
  ).reduce<Record<string, AppointmentLike[]>>(
    (result, appointment) => {
      const normalizedAppointment: AppointmentLike = {
        appointment_date: appointment.appointment_date,
        start_time: normalizeTime(appointment.start_time),
        end_time: normalizeTime(appointment.end_time),
        status: appointment.status,
      };

      result[appointment.appointment_date] = [
        ...(result[appointment.appointment_date] || []),
        normalizedAppointment,
      ];

      return result;
    },
    {}
  );

  const availableDates: string[] = [];

  for (const [date, dateSlots] of Object.entries(
    availabilityByDate
  )) {
    const appointmentsForDate = appointmentsByDate[date] || [];

    const hasAvailableStartTime = dateSlots
      .filter((slot) => slot.status === "available")
      .some((slot) => {
        if (isPastSlot(date, slot.start_time)) {
          return false;
        }

        const hasEnoughContinuousTime =
          hasContinuousAvailability({
            candidateStartTime: slot.start_time,
            durationMinutes: service.duration_minutes,
            slots: dateSlots,
          });

        if (!hasEnoughContinuousTime) {
          return false;
        }

        return !overlapsExistingAppointment({
          startTime: slot.start_time,
          durationMinutes: service.duration_minutes,
          appointments: appointmentsForDate,
        });
      });

    if (hasAvailableStartTime) {
      availableDates.push(date);
    }
  }

  availableDates.sort();

  return {
    month,
    availableDates,
  };
}