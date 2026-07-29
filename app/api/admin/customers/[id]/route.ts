import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

type AppointmentRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_note: string | null;
  service_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
};

function normalizePhone(phone: string) {
  let normalized = phone.replace(/\D/g, "");

  if (normalized.startsWith("972")) {
    normalized = `0${normalized.slice(3)}`;
  }

  return normalized;
}

function getCustomerId(req: Request) {
  const pathname = new URL(req.url).pathname;
  const parts = pathname.split("/").filter(Boolean);

  const customersIndex = parts.lastIndexOf("customers");

  if (customersIndex === -1) {
    return "";
  }

  return decodeURIComponent(parts[customersIndex + 1] || "").trim();
}

export async function GET(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  const customerId = getCustomerId(req);

  if (!customerId) {
    return NextResponse.json(
      { error: "חסר מזהה לקוח" },
      { status: 400 }
    );
  }

  const { data: customer, error: customerError } = await ctx.db
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
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) {
    console.error("Load customer error:", customerError);

    return NextResponse.json(
      { error: "לא ניתן לטעון את פרטי הלקוח" },
      { status: 500 }
    );
  }

  if (!customer) {
    return NextResponse.json(
      { error: "הלקוח לא נמצא" },
      { status: 404 }
    );
  }

  const customerPhone = normalizePhone(customer.phone || "");

  const { data: appointmentData, error: appointmentsError } =
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
        updated_at
        `
      )
      .eq("customer_phone", customerPhone)
      .order("appointment_date", { ascending: false })
      .order("start_time", { ascending: false });

  if (appointmentsError) {
    console.error(
      "Load customer appointments error:",
      appointmentsError
    );

    return NextResponse.json(
      { error: "לא ניתן לטעון את היסטוריית התורים" },
      { status: 500 }
    );
  }

  const appointments = (appointmentData || []) as AppointmentRow[];

  const serviceIds = Array.from(
    new Set(
      appointments
        .map((appointment) => appointment.service_id)
        .filter(
          (serviceId): serviceId is string =>
            typeof serviceId === "string" && serviceId.length > 0
        )
    )
  );

  let services: ServiceRow[] = [];

  if (serviceIds.length > 0) {
    const { data: servicesData, error: servicesError } = await ctx.db
      .from("services")
      .select(
        `
        id,
        name,
        description,
        price,
        duration_minutes
        `
      )
      .in("id", serviceIds);

    if (servicesError) {
      console.error(
        "Load appointment services error:",
        servicesError
      );

      return NextResponse.json(
        { error: "לא ניתן לטעון את פרטי השירותים" },
        { status: 500 }
      );
    }

    services = (servicesData || []) as ServiceRow[];
  }

  const servicesById = new Map(
    services.map((service) => [service.id, service])
  );

  const appointmentsWithServices = appointments.map(
    (appointment) => {
      const service = appointment.service_id
        ? servicesById.get(appointment.service_id)
        : undefined;

      return {
        ...appointment,
        service: service
          ? {
              id: service.id,
              name: service.name,
              description: service.description,
              price: Number(service.price || 0),
              duration_minutes: Number(
                service.duration_minutes || 0
              ),
            }
          : null,
        service_name: service?.name || "שירות לא זמין",
        service_price: Number(service?.price || 0),
      };
    }
  );

  const calculatedTotalSpent = appointmentsWithServices
    .filter((appointment) => appointment.status === "completed")
    .reduce(
      (total, appointment) =>
        total + Number(appointment.service_price || 0),
      0
    );

  return NextResponse.json({
    customer: {
      ...customer,
      phone: customerPhone,
      total_spent: Number(customer.total_spent || 0),
    },
    appointments: appointmentsWithServices,
    summary: {
      total_appointments: appointmentsWithServices.length,
      completed_appointments: appointmentsWithServices.filter(
        (appointment) => appointment.status === "completed"
      ).length,
      pending_appointments: appointmentsWithServices.filter(
        (appointment) =>
          appointment.status === "pending" ||
          appointment.status === "confirmed"
      ).length,
      cancelled_appointments: appointmentsWithServices.filter(
        (appointment) => appointment.status === "cancelled"
      ).length,
      calculated_total_spent: calculatedTotalSpent,
    },
  });
}