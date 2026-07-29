"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin/client";

type SlotStatus = "available" | "blocked" | "booked";

type Slot = {
  id?: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
};

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

function buildSlots(
  date: string,
  startTime: string,
  endTime: string
): Slot[] {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    return [];
  }

  const generatedSlots: Slot[] = [];

  for (
    let current = startMinutes;
    current + 30 <= endMinutes;
    current += 30
  ) {
    generatedSlots.push({
      slot_date: date,
      start_time: minutesToTime(current),
      end_time: minutesToTime(current + 30),
      status: "available",
    });
  }

  return generatedSlots;
}

export default function CalendarPage() {
  const [date, setDate] = useState(getLocalDate());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slots, setSlots] = useState<Slot[]>([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const showMessage = (
    text: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setMessage(text);
    setMessageType(type);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const res = await adminFetch(
        `/api/admin/availability?date=${encodeURIComponent(date)}`
      );

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || "לא ניתן לטעון את שעות היום", "error");
        setSlots([]);
        return;
      }

      const loadedSlots: Slot[] = (data.slots || []).map(
        (slot: Slot) => ({
          ...slot,
          slot_date: slot.slot_date || date,
          start_time: normalizeTime(slot.start_time),
          end_time: normalizeTime(slot.end_time),
          status:
            slot.status === "blocked" || slot.status === "booked"
              ? slot.status
              : "available",
        })
      );

      setSlots(loadedSlots);

      if (loadedSlots.length > 0) {
        setStartTime(loadedSlots[0].start_time);
        setEndTime(loadedSlots[loadedSlots.length - 1].end_time);
      }
    } catch (error) {
      console.error("Load availability error:", error);
      setSlots([]);
      showMessage("אירעה שגיאה בטעינת שעות היום", "error");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableCount = useMemo(
    () => slots.filter((slot) => slot.status === "available").length,
    [slots]
  );

  const blockedCount = useMemo(
    () => slots.filter((slot) => slot.status === "blocked").length,
    [slots]
  );

  const bookedCount = useMemo(
    () => slots.filter((slot) => slot.status === "booked").length,
    [slots]
  );

  const generateDay = () => {
    setGenerating(true);
    setMessage("");

    try {
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      if (endMinutes <= startMinutes) {
        showMessage(
          "שעת הסיום חייבת להיות מאוחרת משעת ההתחלה",
          "error"
        );
        return;
      }

      if ((endMinutes - startMinutes) % 30 !== 0) {
        showMessage(
          "יש לבחור שעות שמתאימות למרווחים של 30 דקות",
          "error"
        );
        return;
      }

      const generatedSlots = buildSlots(date, startTime, endTime);

      if (generatedSlots.length === 0) {
        showMessage("לא ניתן ליצור שעות לפי הטווח שנבחר", "error");
        return;
      }

      const existingBookedSlots = slots.filter(
        (slot) => slot.status === "booked"
      );

      const generatedWithExistingBookings = generatedSlots.map(
        (generatedSlot) => {
          const bookedSlot = existingBookedSlots.find(
            (existingSlot) =>
              existingSlot.start_time === generatedSlot.start_time
          );

          return bookedSlot || generatedSlot;
        }
      );

      const bookedOutsideRange = existingBookedSlots.filter(
        (bookedSlot) =>
          !generatedWithExistingBookings.some(
            (generatedSlot) =>
              generatedSlot.start_time === bookedSlot.start_time
          )
      );

      setSlots([
        ...generatedWithExistingBookings,
        ...bookedOutsideRange,
      ].sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      ));

      showMessage(
        "השעות נוצרו. עכשיו אפשר לסמן הפסקות ולפרסם.",
        "info"
      );
    } finally {
      setGenerating(false);
    }
  };

  const toggleSlot = (selectedSlot: Slot) => {
    if (selectedSlot.status === "booked") {
      showMessage(
        `לא ניתן לחסום את השעה ${selectedSlot.start_time}, מכיוון שכבר קיים בה תור.`,
        "error"
      );
      return;
    }

    setSlots((currentSlots) =>
      currentSlots.map((slot) => {
        if (slot.start_time !== selectedSlot.start_time) {
          return slot;
        }

        return {
          ...slot,
          status:
            slot.status === "available" ? "blocked" : "available",
        };
      })
    );

    setMessage("");
  };

  const publish = async () => {
    if (slots.length === 0) {
      showMessage("יש ליצור שעות לפני הפרסום", "error");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const res = await adminFetch("/api/admin/availability", {
        method: "POST",
        body: JSON.stringify({
          date,
          status: "available",
          slots: slots.map((slot) => ({
            id: slot.id,
            start_time: slot.start_time,
            end_time: slot.end_time,
            status: slot.status,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(
          data.error || "לא ניתן לפרסם את שעות היום",
          "error"
        );
        return;
      }

      showMessage(
        data.message || "שעות היום פורסמו בהצלחה",
        "success"
      );

      await load();
    } catch (error) {
      console.error("Publish availability error:", error);
      showMessage("אירעה שגיאה בפרסום שעות היום", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="admin-header calendar-header">
        <div>
          <p className="eyebrow">יומן וזמינות</p>
          <h1>קביעת שעות ליום עבודה</h1>
          <p className="header-description">
            בחר תאריך, הגדר שעות עבודה, סמן הפסקות ופרסם
            ללקוחות.
          </p>
        </div>
      </div>

      {message ? (
        <div
          className={`panel calendar-message calendar-message-${messageType}`}
          role="status"
        >
          {message}
        </div>
      ) : null}

      <div className="panel calendar-settings">
        <div className="settings-grid">
          <label className="field">
            <span>תאריך</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>

          <label className="field">
            <span>שעת התחלה</span>
            <input
              type="time"
              step="1800"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>

          <label className="field">
            <span>שעת סיום</span>
            <input
              type="time"
              step="1800"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </label>
        </div>

        <div className="settings-actions">
          <button
            className="button"
            type="button"
            onClick={generateDay}
            disabled={generating || loading}
          >
            {generating ? "יוצר שעות..." : "צור שעות ליום"}
          </button>
        </div>
      </div>

      <div className="calendar-summary">
        <div className="summary-card">
          <strong>{availableCount}</strong>
          <span>שעות פנויות</span>
        </div>

        <div className="summary-card">
          <strong>{blockedCount}</strong>
          <span>שעות חסומות</span>
        </div>

        <div className="summary-card">
          <strong>{bookedCount}</strong>
          <span>תורים שנקבעו</span>
        </div>
      </div>

      <div className="panel">
        <div className="slots-header">
          <div>
            <h2>שעות היום</h2>
            <p>
              לחץ על שעה פנויה כדי לסמן אותה כהפסקה. לחץ שוב
              כדי לפתוח אותה.
            </p>
          </div>

          {slots.length > 0 ? (
            <button
              className="button"
              type="button"
              onClick={publish}
              disabled={saving || loading}
            >
              {saving ? "מפרסם..." : "פרסם שעות ללקוחות"}
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="empty-state">טוען שעות...</div>
        ) : null}

        {!loading && slots.length === 0 ? (
          <div className="empty-state">
            <strong>עדיין לא הוגדרו שעות לתאריך הזה.</strong>
            <span>
              בחר שעת התחלה וסיום ולחץ על &quot;צור שעות
              ליום&quot;.
            </span>
          </div>
        ) : null}

        {!loading && slots.length > 0 ? (
          <div className="slots-grid">
            {slots.map((slot) => (
              <button
                key={`${slot.start_time}-${slot.end_time}`}
                type="button"
                className={`slot-button slot-${slot.status}`}
                onClick={() => toggleSlot(slot)}
                disabled={slot.status === "booked"}
                title={
                  slot.status === "booked"
                    ? "כבר קיים תור בשעה זו"
                    : slot.status === "blocked"
                    ? "לחץ כדי לפתוח את השעה"
                    : "לחץ כדי לסמן כהפסקה"
                }
              >
                <span className="slot-time">
                  {slot.start_time}
                </span>

                <span className="slot-label">
                  {slot.status === "available"
                    ? "פנוי"
                    : slot.status === "blocked"
                    ? "הפסקה"
                    : "תפוס"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .calendar-header {
          margin-bottom: 20px;
        }

        .header-description {
          margin: 8px 0 0;
          color: rgba(255, 255, 255, 0.65);
        }

        .calendar-message {
          margin-bottom: 18px;
          font-weight: 700;
        }

        .calendar-message-success {
          border-color: rgba(18, 183, 106, 0.45);
        }

        .calendar-message-error {
          border-color: rgba(240, 68, 56, 0.55);
        }

        .calendar-message-info {
          border-color: rgba(46, 144, 250, 0.45);
        }

        .calendar-settings {
          margin-bottom: 18px;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .settings-actions {
          display: flex;
          margin-top: 18px;
        }

        .calendar-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .summary-card {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.04);
        }

        .summary-card strong {
          font-size: 28px;
        }

        .summary-card span {
          color: rgba(255, 255, 255, 0.65);
        }

        .slots-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .slots-header h2 {
          margin: 0 0 6px;
        }

        .slots-header p {
          margin: 0;
          color: rgba(255, 255, 255, 0.65);
        }

        .slots-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .slot-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 82px;
          padding: 12px;
          border-radius: 14px;
          font-family: inherit;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            border-color 0.15s ease,
            background 0.15s ease;
        }

        .slot-button:not(:disabled):hover {
          transform: translateY(-2px);
        }

        .slot-available {
          color: #d1fadf;
          background: rgba(18, 183, 106, 0.12);
          border: 1px solid rgba(18, 183, 106, 0.42);
        }

        .slot-blocked {
          color: #fedf89;
          background: rgba(247, 144, 9, 0.13);
          border: 1px solid rgba(247, 144, 9, 0.48);
        }

        .slot-booked {
          color: #fecaca;
          background: rgba(240, 68, 56, 0.13);
          border: 1px solid rgba(240, 68, 56, 0.48);
          cursor: not-allowed;
          opacity: 0.8;
        }

        .slot-time {
          font-size: 19px;
          font-weight: 800;
        }

        .slot-label {
          font-size: 13px;
          font-weight: 700;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 220px;
          text-align: center;
          color: rgba(255, 255, 255, 0.65);
        }

        .empty-state strong {
          color: rgba(255, 255, 255, 0.9);
        }

        @media (max-width: 900px) {
          .slots-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .settings-grid,
          .calendar-summary {
            grid-template-columns: 1fr;
          }

          .slots-header {
            flex-direction: column;
          }

          .slots-header button {
            width: 100%;
          }

          .slots-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 420px) {
          .slots-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}