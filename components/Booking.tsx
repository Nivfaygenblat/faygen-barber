"use client";
import { useEffect, useMemo, useState } from "react";
import { isIsraeliPhone } from "@/lib/validations";
import BookingCalendar from "@/components/BookingCalendar";
import "@/components/BookingCalendar.css";

type Service = { name: string; text: string; price: number; time: number };
type AvailabilityResponse = { slots: string[]; booked: { start_time: string; end_time: string }[]; serviceDurationMinutes?: number };

export default function Booking({ services }: { services: Service[] }) {
  const [form, setForm] = useState({ service: services[0].name, date: "", time: "", name: "", phone: "", note: "" });
  const [slots, setSlots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const min = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!form.date) {
      setSlots([]);
      return;
    }

    setLoading(true);
    fetch(`/api/availability?date=${form.date}&service=${encodeURIComponent(form.service)}`)
      .then((r) => r.json())
      .then((d: AvailabilityResponse) => {
        setSlots(d.slots || []);
        if (form.time && !(d.slots || []).includes(form.time)) {
          setForm((prev) => ({ ...prev, time: "" }));
        }
      })
      .finally(() => setLoading(false));
  }, [form.date, form.service]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.date || !form.time || form.name.length < 2) {
      setError("יש למלא שם, תאריך ושעה.");
      return;
    }

    if (!isIsraeliPhone(form.phone)) {
      setError("נא להזין מספר טלפון ישראלי תקין.");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "לא הצלחנו לשמור את התור");
      setDone(true);
      setSlots([]);
      setForm((prev) => ({ ...prev, time: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="booking" id="booking">
      <div className="booking-grid">
        <div className="booking-copy reveal">
          <p className="eyebrow">קביעת תור אונליין</p>
          <h2>
            הזמן שלך.<br />
            <em>הסטייל שלך.</em>
          </h2>
          <p>בחר שירות, תאריך ושעה. לאחר אישור התור יוצג מסך אישור עם כל פרטי ההזמנה.</p>
        </div>

        <form className="booking-form" onSubmit={submit}>
          {done ? (
            <div className="success">
              <div className="success-mark">✓</div>
              <h3>התור נקבע בהצלחה.</h3>
              <p>
                תודה שבחרת ב־FAYGEN BARBER.<br />
                מחכים לראות אותך.
              </p>
              <div className="panel">
                <b>{form.service}</b>
                <p>
                  {form.date} · {form.time}
                  <br />
                  {form.name} · {form.phone}
                </p>
              </div>
              <a className="button" href="#home">
                חזרה לדף הבית
              </a>
            </div>
          ) : (
            <>
              <div className="steps">
                <b>01 בחירת תאריך ושעה</b>
                <span>02 פרטים אישיים</span>
                <span>03 אישור</span>
              </div>

              <div className="field">
                <label htmlFor="service">השירות שלך</label>
                <select
                  id="service"
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value, date: "", time: "" })}
                >
                  {services.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} · {s.time} דקות · ₪{s.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <BookingCalendar
                  service={form.service}
                  selectedDate={form.date}
                  onSelectDate={(date) => setForm((prev) => ({ ...prev, date, time: "" }))}
                  onMonthChange={() => undefined}
                  serviceName={form.service}
                />
              </div>

              <div className="field">
                <label>בחר שעה פנויה</label>
                {loading ? (
                  <p>בודקים שעות פנויות…</p>
                ) : slots.length > 0 ? (
                  <div className="slots">
                    {slots.map((s) => (
                      <button
                        className={`slot ${form.time === s ? "active" : ""}`}
                        type="button"
                        key={s}
                        onClick={() => setForm((prev) => ({ ...prev, time: s }))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="calendar-note">אין תורים זמינים ליום זה.</p>
                )}
              </div>

              <div className="field">
                <label htmlFor="name">שם מלא</label>
                <input
                  id="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="phone">טלפון</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="052-000-0000"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="note">הערה לספר (לא חובה)</label>
                <textarea
                  id="note"
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>

              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}

              <button className="button" disabled={busy}>
                {busy ? "שולחים תור..." : "קבע תור"}
              </button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
