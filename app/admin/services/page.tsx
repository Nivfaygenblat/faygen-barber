"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin/client";

type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
};

type ServiceForm = {
  name: string;
  description: string;
  price: string;
  duration_minutes: string;
};

const emptyForm: ServiceForm = {
  name: "",
  description: "",
  price: "",
  duration_minutes: "30",
};

export default function ServicesPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<
    "success" | "error"
  >("success");

  const toastTimer = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setToast(message);
    setToastType(type);

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    toastTimer.current = setTimeout(() => {
      setToast("");
    }, 3000);
  };

  const load = async () => {
    setLoading(true);

    try {
      const res = await adminFetch(
        "/api/admin/services"
      );

      const data = await res.json();

      if (!res.ok) {
        showToast(
          data.error || "לא ניתן לטעון שירותים",
          "error"
        );
        return;
      }

      setItems(data.services || []);
    } catch (error) {
      console.error("Load services error:", error);

      showToast(
        "אירעה שגיאה בטעינת השירותים",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const save = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setSaving(true);

    try {
      const res = await adminFetch(
        "/api/admin/services",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            price: Number(form.price),
            duration_minutes: Number(
              form.duration_minutes
            ),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        showToast(
          data.error || "לא ניתן לשמור שירות",
          "error"
        );
        return;
      }

      setForm(emptyForm);
      showToast(
        data.message || "השירות נשמר בהצלחה"
      );

      await load();
    } catch (error) {
      console.error("Save service error:", error);

      showToast(
        "אירעה שגיאה בשמירת השירות",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ServiceItem) => {
    const confirmed = window.confirm(
      `למחוק את השירות "${item.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);

    try {
      const res = await adminFetch(
        "/api/admin/services",
        {
          method: "DELETE",
          body: JSON.stringify({
            id: item.id,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        showToast(
          data.error || "לא ניתן למחוק שירות",
          "error"
        );
        return;
      }

      setItems((currentItems) =>
        currentItems.filter(
          (service) => service.id !== item.id
        )
      );

      showToast(
        data.message || "השירות נמחק בהצלחה"
      );
    } catch (error) {
      console.error("Delete service error:", error);

      showToast(
        "אירעה שגיאה במחיקת השירות",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    showToast("השדות נוקו");
  };

  return (
    <div>
      {toast ? (
        <div
          className={`admin-toast admin-toast-${toastType}`}
          role="status"
        >
          {toastType === "success" ? "✓" : "!"}
          <span>{toast}</span>
        </div>
      ) : null}

      <div className="admin-header">
        <div>
          <p className="eyebrow">שירותים</p>
          <h1>ניהול שירותים</h1>
        </div>
      </div>

      <form className="panel" onSubmit={save}>
        <div className="grid-2">
          <label className="field">
            <span>שם השירות</span>

            <input
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              required
            />
          </label>

          <label className="field">
            <span>מחיר</span>

            <input
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(e) =>
                setForm({
                  ...form,
                  price: e.target.value,
                })
              }
              required
            />
          </label>

          <label className="field">
            <span>משך (דקות)</span>

            <input
              type="number"
              min="5"
              step="5"
              value={form.duration_minutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  duration_minutes:
                    e.target.value,
                })
              }
              required
            />
          </label>

          <label className="field">
            <span>תיאור</span>

            <input
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value,
                })
              }
            />
          </label>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            className="button"
            type="submit"
            disabled={saving}
          >
            {saving ? "שומר..." : "הוסף שירות"}
          </button>

          <button
            className="outline-button"
            type="button"
            onClick={resetForm}
            disabled={saving}
          >
            בטל
          </button>
        </div>
      </form>

      <div className="stack">
        {loading ? (
          <div className="panel">
            טוען שירותים...
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="panel">
            עדיין לא נוספו שירותים.
          </div>
        ) : null}

        {items.map((item) => (
          <div
            key={item.id}
            className="panel card-row"
          >
            <div>
              <strong>{item.name}</strong>

              <p>
                {item.description || "אין תיאור"}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div className="chip">
                ₪{item.price} ·{" "}
                {item.duration_minutes} דקות
              </div>

              <button
                type="button"
                onClick={() => remove(item)}
                disabled={deletingId === item.id}
                style={{
                  border: "1px solid #b42318",
                  background: "transparent",
                  color: "#b42318",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  cursor:
                    deletingId === item.id
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    deletingId === item.id
                      ? 0.6
                      : 1,
                  fontWeight: 700,
                }}
              >
                {deletingId === item.id
                  ? "מוחק..."
                  : "מחק"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .admin-toast {
          position: fixed;
          top: 24px;
          left: 24px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 250px;
          max-width: calc(100vw - 48px);
          padding: 14px 18px;
          border-radius: 12px;
          box-shadow: 0 14px 40px
            rgba(0, 0, 0, 0.2);
          font-weight: 700;
          animation: toast-in 0.2s ease-out;
        }

        .admin-toast-success {
          background: #ecfdf3;
          color: #027a48;
          border: 1px solid #abefc6;
        }

        .admin-toast-error {
          background: #fef3f2;
          color: #b42318;
          border: 1px solid #fecdca;
        }

        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 600px) {
          .admin-toast {
            top: 16px;
            left: 16px;
            right: 16px;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}