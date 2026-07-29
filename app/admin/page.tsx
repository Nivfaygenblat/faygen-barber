"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/client";

type Overview = {
  todayAppointments: number;
  weeklyAppointments: number;
  newCustomers: number;
  activeServices: number;
  availableSlots: number;
};

export default function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      try {
        setLoading(true);
        setMessage("");

        const res = await adminFetch("/api/admin/overview");
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "לא ניתן לטעון נתונים");
        }

        setOverview({
          todayAppointments: Number(data.todayAppointments ?? 0),
          weeklyAppointments: Number(data.weeklyAppointments ?? 0),
          newCustomers: Number(data.newCustomers ?? 0),
          activeServices: Number(data.activeServices ?? 0),
          availableSlots: Number(data.availableSlots ?? 0),
        });
      } catch (error) {
        console.error("Dashboard overview error:", error);

        setMessage(
          error instanceof Error
            ? error.message
            : "לא ניתן לטעון את נתוני לוח הניהול"
        );
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, []);

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="eyebrow">לוח ראשי</p>
          <h1>מבט מהיר</h1>
        </div>

        <Link href="/" className="button">
          חזרה לאתר
        </Link>
      </div>

      {message ? (
        <div className="panel info-box">{message}</div>
      ) : null}

      <div className="cards-grid">
        <div className="stat-card">
          <span>תורים היום</span>
          <strong>
            {loading ? "..." : overview?.todayAppointments ?? 0}
          </strong>
        </div>

        <div className="stat-card">
          <span>תורים השבוע</span>
          <strong>
            {loading ? "..." : overview?.weeklyAppointments ?? 0}
          </strong>
        </div>

        <div className="stat-card">
          <span>שעות פנויות היום</span>
          <strong>
            {loading ? "..." : overview?.availableSlots ?? 0}
          </strong>
        </div>

        <div className="stat-card">
          <span>לקוחות חדשים</span>
          <strong>
            {loading ? "..." : overview?.newCustomers ?? 0}
          </strong>
        </div>

        <div className="stat-card">
          <span>שירותים פעילים</span>
          <strong>
            {loading ? "..." : overview?.activeServices ?? 0}
          </strong>
        </div>
      </div>

      <div className="actions-grid">
        <Link href="/admin/calendar" className="action-card">
          פתיחת יומן
        </Link>

        <Link href="/admin/content" className="action-card">
          עריכת האתר
        </Link>

        <Link href="/admin/users" className="action-card">
          ניהול מנהלים
        </Link>

        <Link href="/admin/settings" className="action-card">
          הגדרות
        </Link>
      </div>
    </div>
  );
}