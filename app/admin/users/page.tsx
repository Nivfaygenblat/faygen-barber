"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin/client";

type UserRole = "owner" | "manager" | "admin";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  last_login_at: string | null;
};

type UsersResponse = {
  users?: AdminUser[];
  currentUserId?: string;
  currentUserRole?: UserRole;
  error?: string;
};

type UserResponse = {
  user?: AdminUser;
  message?: string;
  error?: string;
};

type UserForm = {
  full_name: string;
  phone: string;
  email: string;
  password: string;
  role: "manager" | "admin";
  is_active: boolean;
};

const EMPTY_FORM: UserForm = {
  full_name: "",
  phone: "",
  email: "",
  password: "",
  role: "admin",
  is_active: true,
};

function getRoleLabel(role: UserRole) {
  switch (role) {
    case "owner":
      return "מנהל מערכת";
    case "manager":
      return "מנהל עסק";
    case "admin":
      return "מנהל רגיל";
    default:
      return role;
  }
}

function getRoleDescription(role: UserRole) {
  switch (role) {
    case "owner":
      return "גישה מלאה לכל חלקי המערכת";
    case "manager":
      return "ניהול העסק, מנהלים, תורים ותוכן";
    case "admin":
      return "ניהול שוטף ללא ניהול משתמשים";
    default:
      return "";
  }
}

function formatDate(value: string | null) {
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

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] =
    useState<UserRole | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  const activeManagersCount = useMemo(
    () =>
      users.filter(
        (user) => user.role === "manager" && user.is_active !== false
      ).length,
    [users]
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const response = await adminFetch("/api/admin/users");
      const data = await readJson<UsersResponse>(response);

      if (!response.ok) {
        throw new Error(data?.error || "לא ניתן לטעון את רשימת המנהלים");
      }

      setUsers(Array.isArray(data?.users) ? data.users : []);
      setCurrentUserId(data?.currentUserId || "");
      setCurrentUserRole(data?.currentUserRole || null);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "לא ניתן לטעון את רשימת המנהלים"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function closeForm() {
    if (saving) {
      return;
    }

    setIsFormOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function openCreateForm() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }

  function openEditForm(user: AdminUser) {
    if (user.role === "owner") {
      return;
    }

    setEditingUser(user);
    setForm({
      full_name: user.full_name || "",
      phone: user.phone || "",
      email: user.email || "",
      password: "",
      role: user.role === "manager" ? "manager" : "admin",
      is_active: user.is_active !== false,
    });
    setFormError("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }

  function updateForm<K extends keyof UserForm>(
    field: K,
    value: UserForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateForm() {
    const fullName = form.full_name.trim();
    const email = form.email.trim().toLowerCase();

    if (fullName.length < 2) {
      return "יש להזין שם מלא";
    }

    if (!email || !email.includes("@")) {
      return "יש להזין כתובת אימייל תקינה";
    }

    if (!editingUser && form.password.length < 6) {
      return "הסיסמה חייבת להכיל לפחות 6 תווים";
    }

    if (
      editingUser &&
      form.password.length > 0 &&
      form.password.length < 6
    ) {
      return "הסיסמה החדשה חייבת להכיל לפחות 6 תווים";
    }

    if (
      editingUser?.role === "manager" &&
      form.role !== "manager" &&
      editingUser.is_active !== false &&
      activeManagersCount <= 1
    ) {
      return "לא ניתן להוריד את דרגת מנהל העסק האחרון";
    }

    if (
      editingUser?.role === "manager" &&
      editingUser.is_active !== false &&
      form.is_active === false &&
      activeManagersCount <= 1
    ) {
      return "לא ניתן להשעות את מנהל העסק האחרון";
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");
    setSuccessMessage("");

    const payload = {
      ...(editingUser ? { id: editingUser.id } : {}),
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: form.role,
      ...(editingUser ? { is_active: form.is_active } : {}),
    };

    try {
      const response = await adminFetch("/api/admin/users", {
        method: editingUser ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      const data = await readJson<UserResponse>(response);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (editingUser
              ? "לא ניתן לעדכן את המנהל"
              : "לא ניתן ליצור את המנהל")
        );
      }

      setSuccessMessage(
        data?.message ||
          (editingUser
            ? "פרטי המנהל עודכנו בהצלחה"
            : "המנהל נוסף בהצלחה")
      );

      setIsFormOpen(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);

      await loadUsers();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "אירעה שגיאה בשמירת המנהל"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (user.role === "owner") {
      return;
    }

    if (user.id === currentUserId) {
      setPageError("לא ניתן למחוק את החשבון שאיתו אתה מחובר");
      return;
    }

    if (
      user.role === "manager" &&
      user.is_active !== false &&
      activeManagersCount <= 1
    ) {
      setPageError("לא ניתן למחוק את מנהל העסק האחרון");
      return;
    }

    const displayName = user.full_name || user.email || "המנהל";

    const confirmed = window.confirm(
      `האם למחוק את ${displayName}?\n\nהפעולה תמחק את חשבון ההתחברות ולא ניתן לבטל אותה.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(user.id);
    setPageError("");
    setSuccessMessage("");

    try {
      const response = await adminFetch("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({
          id: user.id,
        }),
      });

      const data = await readJson<UserResponse>(response);

      if (!response.ok) {
        throw new Error(data?.error || "לא ניתן למחוק את המנהל");
      }

      setSuccessMessage(data?.message || "המנהל נמחק בהצלחה");
      await loadUsers();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "אירעה שגיאה במחיקת המנהל"
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold text-amber-600">
            ניהול והרשאות
          </p>

          <h1 className="text-3xl font-bold text-zinc-900">
            מנהלים ומשתמשים
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            יצירה, עריכה וניהול הרשאות של צוות הניהול
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          disabled={loading || currentUserRole === "admin"}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-lg leading-none">+</span>
          הוסף מנהל
        </button>
      </div>

      {successMessage ? (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <span>{successMessage}</span>

          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            className="font-bold"
            aria-label="סגור הודעה"
          >
            ×
          </button>
        </div>
      ) : null}

      {pageError ? (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          <span>{pageError}</span>

          <button
            type="button"
            onClick={() => setPageError("")}
            className="font-bold"
            aria-label="סגור הודעה"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="סה״כ משתמשים"
          value={users.length}
          subtitle="מנהלי מערכת ועסק"
        />

        <SummaryCard
          title="מנהלי עסק פעילים"
          value={activeManagersCount}
          subtitle="חייב להישאר לפחות אחד"
        />

        <SummaryCard
          title="מנהלים רגילים"
          value={users.filter((user) => user.role === "admin").length}
          subtitle="ללא הרשאת ניהול משתמשים"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
              <p className="text-sm font-medium text-zinc-500">
                טוען מנהלים...
              </p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">
              👤
            </div>

            <h2 className="text-lg font-bold text-zinc-900">
              עדיין אין מנהלים להצגה
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              ניתן להוסיף מנהל חדש באמצעות הכפתור למעלה
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] border-collapse text-right">
                <thead className="bg-zinc-50">
                  <tr className="border-b border-zinc-200 text-xs font-bold text-zinc-500">
                    <th className="px-5 py-4">משתמש</th>
                    <th className="px-5 py-4">טלפון</th>
                    <th className="px-5 py-4">תפקיד</th>
                    <th className="px-5 py-4">סטטוס</th>
                    <th className="px-5 py-4">כניסה אחרונה</th>
                    <th className="px-5 py-4">פעולות</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => {
                    const isOwner = user.role === "owner";
                    const isCurrentUser = user.id === currentUserId;
                    const canDelete =
                      !isOwner &&
                      !isCurrentUser &&
                      !(
                        user.role === "manager" &&
                        user.is_active !== false &&
                        activeManagersCount <= 1
                      );

                    return (
                      <tr
                        key={user.id}
                        className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/70"
                      >
                        <td className="px-5 py-4">
                          <UserIdentity
                            user={user}
                            isCurrentUser={isCurrentUser}
                          />
                        </td>

                        <td className="px-5 py-4 text-sm text-zinc-600">
                          {user.phone || "לא הוזן"}
                        </td>

                        <td className="px-5 py-4">
                          <RoleBadge role={user.role} />
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge isActive={user.is_active !== false} />
                        </td>

                        <td className="px-5 py-4 text-sm text-zinc-500">
                          {formatDate(user.last_login_at)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditForm(user)}
                              disabled={isOwner}
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {isOwner ? "מוגן" : "עריכה"}
                            </button>

                            {!isOwner ? (
                              <button
                                type="button"
                                onClick={() => void handleDelete(user)}
                                disabled={
                                  !canDelete || deletingId === user.id
                                }
                                title={
                                  !canDelete
                                    ? isCurrentUser
                                      ? "לא ניתן למחוק את החשבון המחובר"
                                      : "לא ניתן למחוק את מנהל העסק האחרון"
                                    : "מחיקת מנהל"
                                }
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {deletingId === user.id
                                  ? "מוחק..."
                                  : "מחיקה"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-zinc-100 lg:hidden">
              {users.map((user) => {
                const isOwner = user.role === "owner";
                const isCurrentUser = user.id === currentUserId;
                const canDelete =
                  !isOwner &&
                  !isCurrentUser &&
                  !(
                    user.role === "manager" &&
                    user.is_active !== false &&
                    activeManagersCount <= 1
                  );

                return (
                  <article key={user.id} className="p-5">
                    <UserIdentity
                      user={user}
                      isCurrentUser={isCurrentUser}
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <RoleBadge role={user.role} />
                      <StatusBadge isActive={user.is_active !== false} />
                    </div>

                    <dl className="mt-5 grid gap-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-zinc-500">טלפון</dt>
                        <dd className="text-left text-zinc-800">
                          {user.phone || "לא הוזן"}
                        </dd>
                      </div>

                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-zinc-500">
                          כניסה אחרונה
                        </dt>
                        <dd className="text-left text-zinc-800">
                          {formatDate(user.last_login_at)}
                        </dd>
                      </div>

                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-zinc-500">
                          תאריך יצירה
                        </dt>
                        <dd className="text-left text-zinc-800">
                          {formatDate(user.created_at)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(user)}
                        disabled={isOwner}
                        className="flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-bold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isOwner ? "חשבון מוגן" : "עריכה"}
                      </button>

                      {!isOwner ? (
                        <button
                          type="button"
                          onClick={() => void handleDelete(user)}
                          disabled={!canDelete || deletingId === user.id}
                          className="flex-1 rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingId === user.id ? "מוחק..." : "מחיקה"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeForm();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  {editingUser ? "עריכת מנהל" : "הוספת מנהל חדש"}
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  {editingUser
                    ? "עדכון פרטים, הרשאה וסיסמה"
                    : "יצירת חשבון התחברות חדש למערכת"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-50"
                aria-label="סגור"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              {formError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                  {formError}
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="full_name"
                  className="mb-2 block text-sm font-bold text-zinc-800"
                >
                  שם מלא
                </label>

                <input
                  id="full_name"
                  type="text"
                  value={form.full_name}
                  onChange={(event) =>
                    updateForm("full_name", event.target.value)
                  }
                  autoComplete="name"
                  disabled={saving}
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100"
                  placeholder="לדוגמה: ישראל ישראלי"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-bold text-zinc-800"
                >
                  טלפון
                </label>

                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    updateForm("phone", event.target.value)
                  }
                  autoComplete="tel"
                  disabled={saving}
                  dir="ltr"
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-right text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100"
                  placeholder="050-0000000"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-bold text-zinc-800"
                >
                  אימייל להתחברות
                </label>

                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateForm("email", event.target.value)
                  }
                  autoComplete="email"
                  disabled={saving}
                  dir="ltr"
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-left text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold text-zinc-800"
                >
                  {editingUser ? "סיסמה חדשה" : "סיסמה"}
                </label>

                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateForm("password", event.target.value)
                  }
                  autoComplete="new-password"
                  disabled={saving}
                  dir="ltr"
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-left text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100"
                  placeholder={
                    editingUser
                      ? "השאר ריק כדי לא לשנות"
                      : "לפחות 6 תווים"
                  }
                />

                <p className="mt-2 text-xs text-zinc-500">
                  {editingUser
                    ? "הסיסמה הקיימת תישאר ללא שינוי כאשר השדה ריק"
                    : "המנהל ישתמש באימייל ובסיסמה האלה כדי להתחבר"}
                </p>
              </div>

              <div>
                <span className="mb-2 block text-sm font-bold text-zinc-800">
                  תפקיד
                </span>

                <div className="grid gap-3 sm:grid-cols-2">
                  <RoleOption
                    role="manager"
                    selected={form.role === "manager"}
                    disabled={saving}
                    onSelect={() => updateForm("role", "manager")}
                  />

                  <RoleOption
                    role="admin"
                    selected={form.role === "admin"}
                    disabled={saving}
                    onSelect={() => updateForm("role", "admin")}
                  />
                </div>
              </div>

              {editingUser ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <div>
                      <span className="block text-sm font-bold text-zinc-900">
                        חשבון פעיל
                      </span>

                      <span className="mt-1 block text-xs text-zinc-500">
                        חשבון מושעה נשמר במערכת אך אינו נחשב כמנהל פעיל
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) =>
                        updateForm("is_active", event.target.checked)
                      }
                      disabled={saving}
                      className="h-5 w-5 accent-zinc-900"
                    />
                  </label>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ביטול
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "שומר..."
                    : editingUser
                      ? "שמור שינויים"
                      : "צור מנהל"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-zinc-900">{value}</p>
      <p className="mt-2 text-xs text-zinc-400">{subtitle}</p>
    </div>
  );
}

function UserIdentity({
  user,
  isCurrentUser,
}: {
  user: AdminUser;
  isCurrentUser: boolean;
}) {
  const firstLetter =
    user.full_name?.trim().charAt(0) ||
    user.email?.trim().charAt(0).toUpperCase() ||
    "?";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-base font-bold text-white">
        {firstLetter}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-zinc-900">
            {user.full_name || "ללא שם"}
          </p>

          {isCurrentUser ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
              החשבון שלך
            </span>
          ) : null}
        </div>

        <p
          dir="ltr"
          className="mt-1 truncate text-left text-xs text-zinc-500"
        >
          {user.email || "ללא אימייל"}
        </p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const classes =
    role === "owner"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : role === "manager"
        ? "border-purple-200 bg-purple-50 text-purple-800"
        : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${classes}`}
    >
      {getRoleLabel(role)}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-zinc-200 bg-zinc-100 text-zinc-600"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isActive ? "bg-emerald-500" : "bg-zinc-400"
        }`}
      />
      {isActive ? "פעיל" : "מושעה"}
    </span>
  );
}

function RoleOption({
  role,
  selected,
  disabled,
  onSelect,
}: {
  role: "manager" | "admin";
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`rounded-xl border p-4 text-right transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-500"
      }`}
    >
      <span className="block text-sm font-bold">
        {getRoleLabel(role)}
      </span>

      <span
        className={`mt-2 block text-xs ${
          selected ? "text-zinc-300" : "text-zinc-500"
        }`}
      >
        {getRoleDescription(role)}
      </span>
    </button>
  );
}