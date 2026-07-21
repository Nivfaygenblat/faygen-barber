"use client";
import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, getMonth, getYear, parseISO } from "date-fns";
import { he } from "date-fns/locale";

type BookingCalendarProps = {
  service: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onMonthChange: (month: string) => void;
  serviceName: string;
};

type MonthAvailabilityResponse = {
  month: string;
  availableDates: string[];
};

const formatMonth = (date: Date) => `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, "0")}`;

export default function BookingCalendar({
  service,
  selectedDate,
  onSelectDate,
  onMonthChange,
  serviceName,
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [monthMessage, setMonthMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedDay = selectedDate ? parseISO(selectedDate) : undefined;

  const fetchMonthAvailability = async (monthKey: string) => {
    setLoading(true);
    const res = await fetch(`/api/availability?month=${monthKey}&service=${encodeURIComponent(serviceName)}`);
    const data: MonthAvailabilityResponse = await res.json();
    const available = Array.isArray(data.availableDates) ? data.availableDates : [];
    setAvailableDates(available);
    if (available.length === 0) {
      setMonthMessage("אין תורים זמינים בחודש זה. ניתן לגלול לחודשים הבאים.");
    } else {
      setMonthMessage("");
    }
    setLoading(false);
  };

  useEffect(() => {
    const monthKey = formatMonth(currentMonth);
    fetchMonthAvailability(monthKey);
    onMonthChange(monthKey);
  }, [currentMonth, serviceName]);

  useEffect(() => {
    if (selectedDate) {
      const selectedMonth = formatMonth(parseISO(selectedDate));
      const newMonth = new Date(`${selectedMonth}-01T00:00:00Z`);
      setCurrentMonth(newMonth);
    }
  }, [selectedDate]);

  const disabledDays = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    return !availableDates.includes(dateKey);
  };

  const handleDayClick = (day: Date | undefined) => {
    if (!day) return;
    const dateKey = format(day, "yyyy-MM-dd");
    if (!availableDates.includes(dateKey)) return;
    onSelectDate(dateKey);
  };

  return (
    <div className="booking-calendar">
      <div className="calendar-header">
        <div className="calendar-title">בחר תאריך</div>
        <div className="calendar-month">{format(currentMonth, "MMMM yyyy", { locale: he })}</div>
      </div>
      <DayPicker
        locale={he}
        mode="single"
        selected={selectedDay}
        required={false}
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        onSelect={handleDayClick}
        disabled={(date) => {
          if (date < new Date()) {
            return true;
          }
          return disabledDays(date);
        }}
        modifiers={{ available: (date) => availableDates.includes(format(date, "yyyy-MM-dd")) }}
        modifiersClassNames={{ available: "available-day" }}
        showOutsideDays={true}
        className="rtl-daypicker"
      />
      {loading && <p className="calendar-note">טוען ימים זמינים…</p>}
      {monthMessage && <p className="calendar-note">{monthMessage}</p>}
    </div>
  );
}
