import { NextResponse } from "next/server";
import { getBookingAvailability, getAvailableDatesForMonth } from "@/lib/booking/availability";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const month = url.searchParams.get("month");
  const service = url.searchParams.get("service") || "";

  if (!service) {
    return NextResponse.json({ error: "חסר שירות" }, { status: 400 });
  }

  if (date) {
    const availability = await getBookingAvailability({ date, serviceName: service });
    return NextResponse.json({
      date: availability.date,
      slots: availability.slots,
      booked: availability.booked,
      serviceDurationMinutes: availability.serviceDurationMinutes,
    });
  }

  if (month) {
    const monthAvailability = await getAvailableDatesForMonth({ month, serviceName: service });
    return NextResponse.json(monthAvailability);
  }

  return NextResponse.json({ error: "חסר תאריך או חודש" }, { status: 400 });
}
