"use client";

import type { Customer } from "./types";

type CustomerCardProps = {
  customer: Customer;
  onOpen: (customer: Customer) => void;
};

function formatDate(value: string | null) {
  if (!value) {
    return "אין עדיין";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatPhoneForLink(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export default function CustomerCard({
  customer,
  onOpen,
}: CustomerCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-lg font-bold text-white">
              {customer.full_name.trim().charAt(0) || "?"}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-zinc-900">
                {customer.full_name}
              </h2>

              <a
                href={`tel:${formatPhoneForLink(customer.phone)}`}
                dir="ltr"
                className="mt-1 block w-fit text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
              >
                {customer.phone}
              </a>
            </div>
          </div>

          <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">
            {customer.total_appointments} תורים
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DateBox
            label="ביקור ראשון"
            value={formatDate(customer.first_visit)}
          />

          <DateBox
            label="ביקור אחרון"
            value={formatDate(customer.last_visit)}
          />

          <DateBox
            label="ביקור הבא"
            value={formatDate(customer.next_visit)}
            highlight={Boolean(customer.next_visit)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatusBox
            label="בוצעו"
            value={customer.completed_appointments}
            type="completed"
          />

          <StatusBox
            label="ממתינים"
            value={customer.pending_appointments}
            type="pending"
          />

          <StatusBox
            label="בוטלו"
            value={customer.cancelled_appointments}
            type="cancelled"
          />
        </div>

        <div className="rounded-xl bg-zinc-50 p-4">
          <p className="mb-2 text-xs font-bold text-zinc-500">
            הערות
          </p>

          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {customer.notes?.trim() || "אין הערות על הלקוח"}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row">
          <a
            href={`tel:${formatPhoneForLink(customer.phone)}`}
            className="flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-bold text-zinc-700 transition hover:bg-zinc-100"
          >
            התקשר
          </a>

          <button
            type="button"
            onClick={() => onOpen(customer)}
            className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-700"
          >
            פתח כרטיס
          </button>
        </div>
      </div>
    </article>
  );
}

function DateBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-emerald-200 bg-emerald-50"
          : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <p
        className={`text-xs font-bold ${
          highlight ? "text-emerald-700" : "text-zinc-500"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-2 text-sm font-bold ${
          highlight ? "text-emerald-900" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBox({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type: "completed" | "pending" | "cancelled";
}) {
  const styles = {
    completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    cancelled: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <div
      className={`rounded-xl border p-3 text-center ${styles[type]}`}
    >
      <p className="text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-bold">{label}</p>
    </div>
  );
}