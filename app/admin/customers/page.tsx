"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;

  first_visit: string | null;
  last_visit: string | null;
  next_visit: string | null;

  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  pending_appointments: number;
  total_spent: number;
};

type CustomerAppointment = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;

  appointment_date: string;
  start_time: string | null;
  end_time: string | null;

  appointment_status: string | null;
  internal_note: string | null;

  service_id: string | null;
  service_name?: string | null;
  service_price?: number | null;

  created_at?: string | null;
};

type CustomerSummary = {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  pendingAppointments: number;
  totalSpent: number;
};

type CustomerDetailsResponse = {
  customer: Customer;
  appointments: CustomerAppointment[];
  summary?: Partial<CustomerSummary>;
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function getWhatsAppPhone(phone: string): string {
  const normalized = normalizePhone(phone);

  if (normalized.startsWith("972")) {
    return normalized;
  }

  if (normalized.startsWith("0")) {
    return `972${normalized.slice(1)}`;
  }

  return normalized;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) {
    return "לא הוזן";
  }

  const normalized = normalizePhone(phone);

  if (normalized.length === 10 && normalized.startsWith("05")) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(
      6
    )}`;
  }

  return phone;
}

function formatDate(
  value: string | null | undefined,
  includeYear = true
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return value.slice(0, 5);
}

function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function getStatusLabel(status: string | null | undefined): string {
  const normalized = status?.toLowerCase().trim();

  switch (normalized) {
    case "completed":
    case "complete":
    case "done":
      return "הושלם";

    case "cancelled":
    case "canceled":
      return "בוטל";

    case "confirmed":
      return "מאושר";

    case "pending":
      return "ממתין";

    case "no_show":
    case "no-show":
    case "noshow":
      return "לא הגיע";

    default:
      return status || "ללא סטטוס";
  }
}

function getStatusClasses(status: string | null | undefined): string {
  const normalized = status?.toLowerCase().trim();

  switch (normalized) {
    case "completed":
    case "complete":
    case "done":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "cancelled":
    case "canceled":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    case "confirmed":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "no_show":
    case "no-show":
    case "noshow":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300";

    default:
      return "border-white/15 bg-white/5 text-zinc-300";
  }
}

function safeNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeCustomer(rawCustomer: Partial<Customer>): Customer {
  return {
    id: String(rawCustomer.id ?? ""),
    full_name: String(rawCustomer.full_name ?? "לקוח ללא שם"),
    phone: String(rawCustomer.phone ?? ""),
    email: rawCustomer.email ?? null,
    notes: rawCustomer.notes ?? null,
    created_at: String(rawCustomer.created_at ?? ""),
    updated_at: rawCustomer.updated_at ?? null,

    first_visit: rawCustomer.first_visit ?? null,
    last_visit: rawCustomer.last_visit ?? null,
    next_visit: rawCustomer.next_visit ?? null,

    total_appointments: safeNumber(rawCustomer.total_appointments),
    completed_appointments: safeNumber(rawCustomer.completed_appointments),
    cancelled_appointments: safeNumber(rawCustomer.cancelled_appointments),
    pending_appointments: safeNumber(rawCustomer.pending_appointments),
    total_spent: safeNumber(rawCustomer.total_spent),
  };
}

function extractCustomers(payload: unknown): Customer[] {
  if (Array.isArray(payload)) {
    return payload.map((customer) =>
      normalizeCustomer(customer as Partial<Customer>)
    );
  }

  if (
    payload &&
    typeof payload === "object" &&
    "customers" in payload &&
    Array.isArray((payload as { customers?: unknown[] }).customers)
  ) {
    return (payload as { customers: Partial<Customer>[] }).customers.map(
      normalizeCustomer
    );
  }

  return [];
}

function buildSummary(
  customer: Customer,
  appointments: CustomerAppointment[],
  responseSummary?: Partial<CustomerSummary>
): CustomerSummary {
  const completedStatuses = new Set(["completed", "complete", "done"]);
  const cancelledStatuses = new Set(["cancelled", "canceled"]);
  const pendingStatuses = new Set(["pending", "confirmed"]);

  const calculatedCompleted = appointments.filter((appointment) =>
    completedStatuses.has(
      appointment.appointment_status?.toLowerCase().trim() ?? ""
    )
  ).length;

  const calculatedCancelled = appointments.filter((appointment) =>
    cancelledStatuses.has(
      appointment.appointment_status?.toLowerCase().trim() ?? ""
    )
  ).length;

  const calculatedPending = appointments.filter((appointment) =>
    pendingStatuses.has(
      appointment.appointment_status?.toLowerCase().trim() ?? ""
    )
  ).length;

  const calculatedTotalSpent = appointments
    .filter((appointment) =>
      completedStatuses.has(
        appointment.appointment_status?.toLowerCase().trim() ?? ""
      )
    )
    .reduce(
      (total, appointment) => total + safeNumber(appointment.service_price),
      0
    );

  return {
    totalAppointments:
      responseSummary?.totalAppointments ??
      customer.total_appointments ??
      appointments.length,

    completedAppointments:
      responseSummary?.completedAppointments ??
      customer.completed_appointments ??
      calculatedCompleted,

    cancelledAppointments:
      responseSummary?.cancelledAppointments ??
      customer.cancelled_appointments ??
      calculatedCancelled,

    pendingAppointments:
      responseSummary?.pendingAppointments ??
      customer.pending_appointments ??
      calculatedPending,

    totalSpent:
      responseSummary?.totalSpent ??
      customer.total_spent ??
      calculatedTotalSpent,
  };
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();

  if (!supabase) {
    throw new Error("חיבור Supabase אינו מוגדר");
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error("לא ניתן לקרוא את פרטי ההתחברות");
  }

  if (!session?.access_token) {
    throw new Error("ההתחברות פגה. יש להתחבר מחדש");
  }

  return session.access_token;
}
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerAppointments, setCustomerAppointments] = useState<
    CustomerAppointment[]
  >([]);
  const [customerSummary, setCustomerSummary] =
    useState<CustomerSummary | null>(null);

  const [searchValue, setSearchValue] = useState("");

  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);

  const [customersError, setCustomersError] = useState("");
  const [customerDetailsError, setCustomerDetailsError] = useState("");

 const loadCustomers = useCallback(async () => {
  setLoadingCustomers(true);
  setCustomersError("");

  try {
    const accessToken = await getAccessToken();

    const response = await fetch("/api/admin/customers", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "טעינת הלקוחות נכשלה";

      throw new Error(message);
    }

    setCustomers(extractCustomers(payload));
  } catch (error) {
    console.error("Failed to load customers:", error);

    setCustomersError(
      error instanceof Error
        ? error.message
        : "אירעה שגיאה בעת טעינת הלקוחות"
    );
  } finally {
    setLoadingCustomers(false);
  }
}, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (!selectedCustomer) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCustomer(null);
        setCustomerAppointments([]);
        setCustomerSummary(null);
        setCustomerDetailsError("");
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [selectedCustomer]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return customers;
    }

    const phoneSearch = normalizePhone(normalizedSearch);

    return customers.filter((customer) => {
      const nameMatches = customer.full_name
        .toLowerCase()
        .includes(normalizedSearch);

      const emailMatches = customer.email
        ?.toLowerCase()
        .includes(normalizedSearch);

      const phoneMatches =
        phoneSearch.length > 0 &&
        normalizePhone(customer.phone).includes(phoneSearch);

      return Boolean(nameMatches || emailMatches || phoneMatches);
    });
  }, [customers, searchValue]);

  const totalAppointments = useMemo(
    () =>
      customers.reduce(
        (total, customer) => total + safeNumber(customer.total_appointments),
        0
      ),
    [customers]
  );

  const totalRevenue = useMemo(
    () =>
      customers.reduce(
        (total, customer) => total + safeNumber(customer.total_spent),
        0
      ),
    [customers]
  );

  async function openCustomerCard(customer: Customer) {
  setSelectedCustomer(customer);
  setCustomerAppointments([]);
  setCustomerSummary(null);
  setCustomerDetailsError("");
  setLoadingCustomerDetails(true);

  try {
    const accessToken = await getAccessToken();

    const response = await fetch(`/api/admin/customers/${customer.id}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = (await response
      .json()
      .catch(() => null)) as CustomerDetailsResponse | null;

    if (!response.ok) {
      const errorMessage =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "טעינת כרטיס הלקוח נכשלה";

      throw new Error(errorMessage);
    }

    if (!payload?.customer) {
      throw new Error("השרת לא החזיר פרטי לקוח");
    }

    const normalizedCustomer = normalizeCustomer(payload.customer);
    const appointments = Array.isArray(payload.appointments)
      ? payload.appointments
      : [];

    setSelectedCustomer(normalizedCustomer);
    setCustomerAppointments(appointments);
    setCustomerSummary(
      buildSummary(normalizedCustomer, appointments, payload.summary)
    );
  } catch (error) {
    console.error("Failed to load customer details:", error);

    setCustomerDetailsError(
      error instanceof Error
        ? error.message
        : "אירעה שגיאה בעת טעינת כרטיס הלקוח"
    );
  } finally {
    setLoadingCustomerDetails(false);
  }
}
  function closeCustomerCard() {
    setSelectedCustomer(null);
    setCustomerAppointments([]);
    setCustomerSummary(null);
    setCustomerDetailsError("");
  }

  function callCustomer(phone: string) {
    if (!phone) {
      return;
    }

    window.location.href = `tel:${normalizePhone(phone)}`;
  }

  function openWhatsApp(customer: Customer) {
    const phone = getWhatsAppPhone(customer.phone);

    if (!phone) {
      return;
    }

    const message = encodeURIComponent(
      `היי ${customer.full_name}, כאן FAYGEN BARBER 👋`
    );

    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener");
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#080808] px-4 py-6 text-white sm:px-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium tracking-[0.22em] text-amber-400">
              FAYGEN BARBER
            </p>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              ניהול לקוחות
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              צפייה בפרטי לקוחות, היסטוריית תורים, נתוני פעילות ופרטי קשר.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadCustomers()}
            disabled={loadingCustomers}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingCustomers ? "טוען..." : "רענון לקוחות"}
          </button>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="סה״כ לקוחות"
            value={customers.length.toLocaleString("he-IL")}
          />

          <StatCard
            label="לקוחות מוצגים"
            value={filteredCustomers.length.toLocaleString("he-IL")}
          />

          <StatCard
            label="סה״כ תורים"
            value={totalAppointments.toLocaleString("he-IL")}
          />

          <StatCard
            label="הכנסה מצטברת"
            value={formatCurrency(totalRevenue)}
          />
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20">
          <label
            htmlFor="customer-search"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            חיפוש לקוח
          </label>

          <div className="relative">
            <input
              id="customer-search"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="חיפוש לפי שם, טלפון או אימייל"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10"
            />

            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                ניקוי
              </button>
            )}
          </div>
        </section>

        {customersError && (
          <section className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            <p className="font-semibold">לא ניתן לטעון את רשימת הלקוחות</p>
            <p className="mt-1">{customersError}</p>

            <button
              type="button"
              onClick={() => void loadCustomers()}
              className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 font-semibold text-red-100 transition hover:bg-red-500/30"
            >
              ניסיון נוסף
            </button>
          </section>
        )}

        {loadingCustomers ? (
          <CustomersSkeleton />
        ) : filteredCustomers.length === 0 ? (
          <EmptyCustomers hasSearch={Boolean(searchValue.trim())} />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <article
                key={customer.id}
                className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.025] p-5 shadow-xl shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:border-amber-400/30"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold text-white">
                      {customer.full_name}
                    </h2>

                    <p className="mt-1 text-sm text-zinc-400">
                      {formatPhone(customer.phone)}
                    </p>

                    {customer.email && (
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {customer.email}
                      </p>
                    )}
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-lg font-bold text-amber-300">
                    {customer.full_name.trim().charAt(0) || "ל"}
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3">
                  <MiniStat
                    label="תורים"
                    value={customer.total_appointments}
                  />

                  <MiniStat
                    label="הושלמו"
                    value={customer.completed_appointments}
                  />

                  <MiniStat
                    label="בוטלו"
                    value={customer.cancelled_appointments}
                  />

                  <MiniStat
                    label="סה״כ הוצאות"
                    value={formatCurrency(customer.total_spent)}
                  />
                </div>

                <div className="mb-5 space-y-2 border-y border-white/10 py-4 text-sm">
                  <InfoRow
                    label="ביקור אחרון"
                    value={formatDate(customer.last_visit)}
                  />

                  <InfoRow
                    label="תור הבא"
                    value={formatDate(customer.next_visit)}
                    highlight={Boolean(customer.next_visit)}
                  />

                  <InfoRow
                    label="נוצר בתאריך"
                    value={formatDate(customer.created_at)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => void openCustomerCard(customer)}
                    className="col-span-3 min-h-11 rounded-xl bg-amber-400 px-4 text-sm font-bold text-black transition hover:bg-amber-300"
                  >
                    פתח כרטיס
                  </button>

                  <button
                    type="button"
                    onClick={() => callCustomer(customer.phone)}
                    disabled={!customer.phone}
                    className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    התקשרות
                  </button>

                  <button
                    type="button"
                    onClick={() => openWhatsApp(customer)}
                    disabled={!customer.phone}
                    className="col-span-2 min-h-10 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    WhatsApp
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {selectedCustomer && (
        <CustomerModal
          customer={selectedCustomer}
          appointments={customerAppointments}
          summary={customerSummary}
          loading={loadingCustomerDetails}
          error={customerDetailsError}
          onClose={closeCustomerCard}
          onCall={() => callCustomer(selectedCustomer.phone)}
          onWhatsApp={() => openWhatsApp(selectedCustomer)}
        />
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-xs font-medium tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </article>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span
        className={
          highlight ? "font-semibold text-amber-300" : "text-zinc-200"
        }
      >
        {value}
      </span>
    </div>
  );
}

function CustomersSkeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.035] p-5"
        >
          <div className="mb-3 h-6 w-2/3 rounded bg-white/10" />
          <div className="mb-6 h-4 w-1/3 rounded bg-white/10" />

          <div className="mb-5 grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((__, itemIndex) => (
              <div
                key={itemIndex}
                className="h-16 rounded-xl bg-white/[0.07]"
              />
            ))}
          </div>

          <div className="mb-3 h-4 rounded bg-white/[0.07]" />
          <div className="mb-6 h-4 rounded bg-white/[0.07]" />
          <div className="h-11 rounded-xl bg-white/10" />
        </div>
      ))}
    </section>
  );
}

function EmptyCustomers({ hasSearch }: { hasSearch: boolean }) {
  return (
    <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-2xl">
        👤
      </div>

      <h2 className="mt-4 text-xl font-bold text-white">
        {hasSearch ? "לא נמצאו לקוחות מתאימים" : "עדיין אין לקוחות"}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
        {hasSearch
          ? "נסה לחפש באמצעות שם אחר, מספר טלפון או כתובת אימייל."
          : "לקוחות יופיעו כאן לאחר שייווצרו במערכת."}
      </p>
    </section>
  );
}

type CustomerModalProps = {
  customer: Customer;
  appointments: CustomerAppointment[];
  summary: CustomerSummary | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
};

function CustomerModal({
  customer,
  appointments,
  summary,
  loading,
  error,
  onClose,
  onCall,
  onWhatsApp,
}: CustomerModalProps) {
  const effectiveSummary =
    summary ?? buildSummary(customer, appointments, undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-dialog-title"
        className="max-h-[96vh] w-full overflow-hidden rounded-t-3xl border border-white/10 bg-[#101010] shadow-2xl shadow-black sm:max-w-5xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-amber-400">
              כרטיס לקוח
            </p>

            <h2
              id="customer-dialog-title"
              className="truncate text-2xl font-bold text-white"
            >
              {customer.full_name}
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              {formatPhone(customer.phone)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="סגירת כרטיס לקוח"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </header>

        <div className="max-h-[calc(96vh-102px)] overflow-y-auto px-5 py-6 sm:px-7">
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onCall}
              disabled={!customer.phone}
              className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              התקשרות ללקוח
            </button>

            <button
              type="button"
              onClick={onWhatsApp}
              disabled={!customer.phone}
              className="min-h-11 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              פתיחת WhatsApp
            </button>
          </div>

          {loading ? (
            <CustomerDetailsSkeleton />
          ) : error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
              <p className="font-semibold">כרטיס הלקוח לא נטען</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : (
            <>
              <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <ModalStat
                  label="סה״כ תורים"
                  value={effectiveSummary.totalAppointments}
                />

                <ModalStat
                  label="הושלמו"
                  value={effectiveSummary.completedAppointments}
                />

                <ModalStat
                  label="ממתינים"
                  value={effectiveSummary.pendingAppointments}
                />

                <ModalStat
                  label="בוטלו"
                  value={effectiveSummary.cancelledAppointments}
                />

                <ModalStat
                  label="סה״כ הוצאות"
                  value={formatCurrency(effectiveSummary.totalSpent)}
                />
              </section>

              <section className="mb-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <h3 className="mb-4 text-base font-bold text-white">
                    פרטי קשר
                  </h3>

                  <div className="space-y-3 text-sm">
                    <InfoRow
                      label="שם מלא"
                      value={customer.full_name || "—"}
                    />

                    <InfoRow
                      label="טלפון"
                      value={formatPhone(customer.phone)}
                    />

                    <InfoRow
                      label="אימייל"
                      value={customer.email || "לא הוזן"}
                    />

                    <InfoRow
                      label="לקוח מאז"
                      value={formatDate(customer.created_at)}
                    />

                    <InfoRow
                      label="עדכון אחרון"
                      value={formatDateTime(customer.updated_at)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <h3 className="mb-4 text-base font-bold text-white">
                    נתוני ביקורים
                  </h3>

                  <div className="space-y-3 text-sm">
                    <InfoRow
                      label="ביקור ראשון"
                      value={formatDate(customer.first_visit)}
                    />

                    <InfoRow
                      label="ביקור אחרון"
                      value={formatDate(customer.last_visit)}
                    />

                    <InfoRow
                      label="תור הבא"
                      value={formatDate(customer.next_visit)}
                      highlight={Boolean(customer.next_visit)}
                    />
                  </div>
                </div>
              </section>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h3 className="mb-3 text-base font-bold text-white">הערות</h3>

                <div className="min-h-24 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-300">
                  {customer.notes?.trim() || "אין הערות שמורות עבור לקוח זה."}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      היסטוריית תורים
                    </h3>

                    <p className="mt-1 text-xs text-zinc-500">
                      {appointments.length.toLocaleString("he-IL")} תורים נמצאו
                    </p>
                  </div>
                </div>

                {appointments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-5 py-10 text-center">
                    <p className="font-semibold text-zinc-300">
                      לא נמצאו תורים עבור הלקוח
                    </p>

                    <p className="mt-2 text-sm text-zinc-500">
                      ודא שמספר הטלפון בתורים זהה למספר הטלפון בכרטיס הלקוח.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((appointment) => (
                      <AppointmentItem
                        key={appointment.id}
                        appointment={appointment}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ModalStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-black/25 p-4">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-2 truncate text-lg font-bold text-white">{value}</p>
    </article>
  );
}

function CustomerDetailsSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 rounded-xl bg-white/[0.07]" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-2xl bg-white/[0.07]" />
        <div className="h-56 rounded-2xl bg-white/[0.07]" />
      </div>

      <div className="h-36 rounded-2xl bg-white/[0.07]" />
      <div className="h-64 rounded-2xl bg-white/[0.07]" />
    </div>
  );
}

function AppointmentItem({
  appointment,
}: {
  appointment: CustomerAppointment;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-white">
              {appointment.service_name || "שירות ללא שם"}
            </h4>

            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClasses(
                appointment.appointment_status
              )}`}
            >
              {getStatusLabel(appointment.appointment_status)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
            <span>
              תאריך:{" "}
              <strong className="font-medium text-zinc-200">
                {formatDate(appointment.appointment_date)}
              </strong>
            </span>

            <span>
              שעה:{" "}
              <strong className="font-medium text-zinc-200">
                {formatTime(appointment.start_time)}
                {appointment.end_time
                  ? `–${formatTime(appointment.end_time)}`
                  : ""}
              </strong>
            </span>

            {appointment.service_price != null && (
              <span>
                מחיר:{" "}
                <strong className="font-medium text-zinc-200">
                  {formatCurrency(appointment.service_price)}
                </strong>
              </span>
            )}
          </div>

          {appointment.internal_note?.trim() && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-zinc-400">
              <span className="font-semibold text-zinc-300">הערה פנימית: </span>
              {appointment.internal_note}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}