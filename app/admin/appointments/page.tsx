"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { adminFetch } from "@/lib/admin/client";

type AppointmentStatus = "pending" | "confirmed" | "cancelled";

type ServiceItem = {
  id: string;
  name: string;
};

type AppointmentItem = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_note: string | null;
  service_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  internal_note: string | null;
  created_at: string | null;
  updated_at: string | null;
  services: ServiceItem | null;
};

type AppointmentsResponse = {
  appointments?: AppointmentItem[];
  error?: string;
};

type UpdateResponse = {
  appointment?: AppointmentItem;
  message?: string;
  error?: string;
};

type DialogMode = "note" | "reschedule";

type DialogState = {
  mode: DialogMode;
  appointment: AppointmentItem;
} | null;

function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 10);
}

function formatTime(value: string) {
  return value?.slice(0, 5) || "";
}

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCreatedAt(value: string | null) {
  if (!value) {
    return "לא ידוע";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "לא ידוע";
  }

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getStatusLabel(status: AppointmentStatus) {
  switch (status) {
    case "pending":
      return "ממתין";
    case "confirmed":
      return "מאושר";
    case "cancelled":
      return "בוטל";
  }
}

function getStatusClasses(status: AppointmentStatus) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "confirmed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-800";
  }
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function AppointmentsPage() {
  const [date, setDate] = useState(getToday());
  const [status, setStatus] = useState<"all" | AppointmentStatus>("all");
  const [search, setSearch] = useState("");
  const [serviceId, setServiceId] = useState("all");

  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogNote, setDialogNote] = useState("");
  const [dialogDate, setDialogDate] = useState("");
  const [dialogStartTime, setDialogStartTime] = useState("");
  const [dialogEndTime, setDialogEndTime] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogSaving, setDialogSaving] = useState(false);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();

      if (date) {
        params.set("date", date);
      }

      if (status !== "all") {
        params.set("status", status);
      }

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (serviceId !== "all") {
        params.set("service_id", serviceId);
      }

      const response = await adminFetch(
        `/api/admin/appointments?${params.toString()}`
      );

      const data = await readJson<AppointmentsResponse>(response);

      if (!response.ok) {
        throw new Error(data?.error || "לא ניתן לטעון את התורים");
      }

      setItems(Array.isArray(data?.appointments) ? data.appointments : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "לא ניתן לטעון את התורים"
      );
    } finally {
      setLoading(false);
    }
  }, [date, status, search, serviceId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadAppointments();
    }, search ? 350 : 0);

    return () => window.clearTimeout(timeout);
  }, [loadAppointments, search]);

  const services = useMemo(() => {
    const map = new Map<string, string>();

    for (const item of items) {
      if (item.services?.id && item.services.name) {
        map.set(item.services.id, item.services.name);
      }
    }

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [items]);

  const groupedAppointments = useMemo(() => {
    return items.reduce<Record<string, AppointmentItem[]>>(
      (groups, appointment) => {
        const day = appointment.appointment_date;

        if (!groups[day]) {
          groups[day] = [];
        }

        groups[day].push(appointment);
        return groups;
      },
      {}
    );
  }, [items]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      confirmed: items.filter((item) => item.status === "confirmed").length,
      cancelled: items.filter((item) => item.status === "cancelled").length,
    };
  }, [items]);

  async function changeStatus(
    appointment: AppointmentItem,
    nextStatus: AppointmentStatus
  ) {
    if (nextStatus === "cancelled") {
      const confirmed = window.confirm(
        `האם לבטל את התור של ${appointment.customer_name} בתאריך ${appointment.appointment_date} בשעה ${formatTime(
          appointment.start_time
        )}?`
      );

      if (!confirmed) {
        return;
      }
    }

    setUpdatingId(appointment.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await adminFetch("/api/admin/appointments", {
        method: "PATCH",
        body: JSON.stringify({
          id: appointment.id,
          action: "change_status",
          status: nextStatus,
        }),
      });

      const data = await readJson<UpdateResponse>(response);

      if (!response.ok) {
        throw new Error(data?.error || "לא ניתן לעדכן את התור");
      }

      setSuccessMessage(data?.message || "התור עודכן בהצלחה");
      await loadAppointments();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "לא ניתן לעדכן את התור"
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function openNoteDialog(appointment: AppointmentItem) {
    setDialog({
      mode: "note",
      appointment,
    });
    setDialogNote(appointment.internal_note || "");
    setDialogError("");
  }

  function openRescheduleDialog(appointment: AppointmentItem) {
    setDialog({
      mode: "reschedule",
      appointment,
    });
    setDialogDate(appointment.appointment_date);
    setDialogStartTime(formatTime(appointment.start_time));
    setDialogEndTime(formatTime(appointment.end_time));
    setDialogNote(appointment.internal_note || "");
    setDialogError("");
  }

  function closeDialog() {
    if (dialogSaving) {
      return;
    }

    setDialog(null);
    setDialogError("");
  }

  async function handleDialogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!dialog) {
      return;
    }

    if (
      dialog.mode === "reschedule" &&
      (!dialogDate || !dialogStartTime || !dialogEndTime)
    ) {
      setDialogError("יש לבחור תאריך, שעת התחלה ושעת סיום");
      return;
    }

    if (
      dialog.mode === "reschedule" &&
      dialogEndTime <= dialogStartTime
    ) {
      setDialogError("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }

    setDialogSaving(true);
    setDialogError("");
    setErrorMessage("");
    setSuccessMessage("");

    const payload =
      dialog.mode === "note"
        ? {
            id: dialog.appointment.id,
            action: "update_note",
            internal_note: dialogNote,
          }
        : {
            id: dialog.appointment.id,
            action: "reschedule",
            appointment_date: dialogDate,
            start_time: dialogStartTime,
            end_time: dialogEndTime,
            internal_note: dialogNote,
          };

    try {
      const response = await adminFetch("/api/admin/appointments", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const data = await readJson<UpdateResponse>(response);

      if (!response.ok) {
        throw new Error(data?.error || "לא ניתן לעדכן את התור");
      }

      setSuccessMessage(data?.message || "התור עודכן בהצלחה");
      setDialog(null);
      await loadAppointments();
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "לא ניתן לעדכן את התור"
      );
    } finally {
      setDialogSaving(false);
    }
  }

  function clearFilters() {
    setDate(getToday());
    setStatus("all");
    setSearch("");
    setServiceId("all");
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl p-4 md:p-8">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold text-amber-600">
          ניהול תורים
        </p>

        <h1 className="text-3xl font-bold text-zinc-900">לוח התורים</h1>

        <p className="mt-2 text-sm text-zinc-500">
          אישור, ביטול, העברה וניהול תורים והערות פנימיות
        </p>
      </div>

      {successMessage ? (
        <MessageBox
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage("")}
        />
      ) : null}

      {errorMessage ? (
        <MessageBox
          type="error"
          message={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="סה״כ תורים" value={summary.total} />
        <SummaryCard title="ממתינים" value={summary.pending} />
        <SummaryCard title="מאושרים" value={summary.confirmed} />
        <SummaryCard title="מבוטלים" value={summary.cancelled} />
      </div>

      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label
              htmlFor="appointment-search"
              className="mb-2 block text-xs font-bold text-zinc-600"
            >
              חיפוש לקוח
            </label>

            <input
              id="appointment-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="שם או מספר טלפון"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>

          <div>
            <label
              htmlFor="appointment-date"
              className="mb-2 block text-xs font-bold text-zinc-600"
            >
              תאריך
            </label>

            <input
              id="appointment-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>

          <div>
            <label
              htmlFor="appointment-status"
              className="mb-2 block text-xs font-bold text-zinc-600"
            >
              סטטוס
            </label>

            <select
              id="appointment-status"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as "all" | AppointmentStatus
                )
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="confirmed">מאושר</option>
              <option value="cancelled">בוטל</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="appointment-service"
              className="mb-2 block text-xs font-bold text-zinc-600"
            >
              שירות
            </label>

            <select
              id="appointment-service"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="all">כל השירותים</option>

              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100"
            >
              איפוס סינון
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
            <p className="text-sm font-medium text-zinc-500">
              טוען תורים...
            </p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-4 text-4xl">📅</div>

          <h2 className="text-lg font-bold text-zinc-900">
            לא נמצאו תורים
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            אין תורים שמתאימים לסינון שבחרת
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAppointments).map(
            ([day, appointments]) => (
              <section
                key={day}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4">
                  <h2 className="font-bold text-zinc-900">
                    {formatDate(day)}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    {appointments.length} תורים
                  </p>
                </div>

                <div className="divide-y divide-zinc-100">
                  {appointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      updating={
                        updatingId === appointment.id || dialogSaving
                      }
                      onConfirm={() =>
                        void changeStatus(appointment, "confirmed")
                      }
                      onPending={() =>
                        void changeStatus(appointment, "pending")
                      }
                      onCancel={() =>
                        void changeStatus(appointment, "cancelled")
                      }
                      onNote={() => openNoteDialog(appointment)}
                      onReschedule={() =>
                        openRescheduleDialog(appointment)
                      }
                    />
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      )}

      {dialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  {dialog.mode === "note"
                    ? "הערה פנימית"
                    : "העברת תור"}
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  {dialog.appointment.customer_name} ·{" "}
                  {dialog.appointment.customer_phone}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                disabled={dialogSaving}
                className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                aria-label="סגור"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleDialogSubmit} className="space-y-5 p-5">
              {dialogError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                  {dialogError}
                </div>
              ) : null}

              {dialog.mode === "reschedule" ? (
                <>
                  <div>
                    <label
                      htmlFor="dialog-date"
                      className="mb-2 block text-sm font-bold text-zinc-800"
                    >
                      תאריך חדש
                    </label>

                    <input
                      id="dialog-date"
                      type="date"
                      value={dialogDate}
                      onChange={(event) =>
                        setDialogDate(event.target.value)
                      }
                      disabled={dialogSaving}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="dialog-start"
                        className="mb-2 block text-sm font-bold text-zinc-800"
                      >
                        שעת התחלה
                      </label>

                      <input
                        id="dialog-start"
                        type="time"
                        value={dialogStartTime}
                        onChange={(event) =>
                          setDialogStartTime(event.target.value)
                        }
                        disabled={dialogSaving}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="dialog-end"
                        className="mb-2 block text-sm font-bold text-zinc-800"
                      >
                        שעת סיום
                      </label>

                      <input
                        id="dialog-end"
                        type="time"
                        value={dialogEndTime}
                        onChange={(event) =>
                          setDialogEndTime(event.target.value)
                        }
                        disabled={dialogSaving}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100"
                      />
                    </div>
                  </div>
                </>
              ) : null}

              <div>
                <label
                  htmlFor="dialog-note"
                  className="mb-2 block text-sm font-bold text-zinc-800"
                >
                  הערה פנימית
                </label>

                <textarea
                  id="dialog-note"
                  value={dialogNote}
                  onChange={(event) => setDialogNote(event.target.value)}
                  disabled={dialogSaving}
                  rows={5}
                  placeholder="ההערה זמינה רק לצוות הניהול"
                  className="w-full resize-y rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={dialogSaving}
                  className="flex-1 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  ביטול
                </button>

                <button
                  type="submit"
                  disabled={dialogSaving}
                  className="flex-1 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {dialogSaving
                    ? "שומר..."
                    : dialog.mode === "note"
                      ? "שמור הערה"
                      : "העבר תור"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppointmentCard({
  appointment,
  updating,
  onConfirm,
  onPending,
  onCancel,
  onNote,
  onReschedule,
}: {
  appointment: AppointmentItem;
  updating: boolean;
  onConfirm: () => void;
  onPending: () => void;
  onCancel: () => void;
  onNote: () => void;
  onReschedule: () => void;
}) {
  return (
    <article className="p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-14 min-w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-zinc-900 text-white">
            <strong className="text-lg">
              {formatTime(appointment.start_time)}
            </strong>

            <span className="text-[10px] text-zinc-300">
              עד {formatTime(appointment.end_time)}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-zinc-900">
                {appointment.customer_name}
              </h3>

              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                  appointment.status
                )}`}
              >
                {getStatusLabel(appointment.status)}
              </span>
            </div>

            <a
              href={`tel:${appointment.customer_phone}`}
              dir="ltr"
              className="mt-2 block w-fit text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              {appointment.customer_phone}
            </a>

            <p className="mt-2 text-sm text-zinc-600">
              {appointment.services?.name || "שירות לא ידוע"}
            </p>

            {appointment.customer_note ? (
              <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                הערת לקוח: {appointment.customer_note}
              </p>
            ) : null}

            {appointment.internal_note ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                הערה פנימית: {appointment.internal_note}
              </p>
            ) : null}

            <p className="mt-3 text-[11px] text-zinc-400">
              נוצר בתאריך {formatCreatedAt(appointment.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:max-w-md xl:justify-end">
          {appointment.status !== "confirmed" ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={updating}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              אשר תור
            </button>
          ) : null}

          {appointment.status !== "pending" ? (
            <button
              type="button"
              onClick={onPending}
              disabled={updating}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
            >
              החזר לממתין
            </button>
          ) : null}

          {appointment.status !== "cancelled" ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={updating}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
            >
              בטל תור
            </button>
          ) : null}

          <button
            type="button"
            onClick={onReschedule}
            disabled={updating}
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
          >
            העבר תור
          </button>

          <button
            type="button"
            onClick={onNote}
            disabled={updating}
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
          >
            הערה פנימית
          </button>
        </div>
      </div>
    </article>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function MessageBox({
  type,
  message,
  onClose,
}: {
  type: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const classes =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div
      className={`mb-6 flex items-start justify-between gap-4 rounded-xl border p-4 text-sm font-medium ${classes}`}
    >
      <span>{message}</span>

      <button
        type="button"
        onClick={onClose}
        className="font-bold"
        aria-label="סגור הודעה"
      >
        ×
      </button>
    </div>
  );
}