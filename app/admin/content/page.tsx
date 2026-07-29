"use client";

import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin/client";

type ContentPayload = Record<string, unknown>;

type ContentItem = {
  section_key: string;
  title: string | null;
  body: string | null;
  payload: ContentPayload;
  is_active: boolean;
};

type ContentForm = {
  title: string;
  body: string;

  eyebrow: string;
  subtitle: string;
  button_text: string;

  phone: string;
  address: string;
  hours: string;

  instagram_url: string;
  whatsapp_url: string;
  waze_url: string;

  copyright_text: string;
};

const sections = [
  {
    key: "hero",
    label: "אזור ראשי",
    description: "הכותרת והטקסט הראשי שמופיעים בראש האתר",
  },
  {
    key: "about",
    label: "קצת עליי",
    description: "הכותרת והתוכן של אזור האודות",
  },
  {
    key: "services",
    label: "שירותים",
    description: "הכותרת שמופיעה מעל רשימת השירותים",
  },
  {
    key: "gallery",
    label: "גלריה",
    description: "כותרת הגלריה וקישור לאינסטגרם",
  },
  {
    key: "faq",
    label: "שאלות נפוצות",
    description: "כותרת ופתיח לאזור שאלות נפוצות",
  },
  {
    key: "contact",
    label: "יצירת קשר",
    description: "פרטי יצירת קשר, כתובת ושעות פעילות",
  },
  {
    key: "footer",
    label: "פוטר",
    description: "התוכן שמופיע בתחתית האתר",
  },
] as const;

const emptyForm: ContentForm = {
  title: "",
  body: "",

  eyebrow: "",
  subtitle: "",
  button_text: "",

  phone: "",
  address: "",
  hours: "",

  instagram_url: "",
  whatsapp_url: "",
  waze_url: "",

  copyright_text: "",
};

function getPayloadString(
  payload: ContentPayload | null | undefined,
  key: string
): string {
  const value = payload?.[key];

  return typeof value === "string" ? value : "";
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [active, setActive] = useState<string>(sections[0].key);
  const [form, setForm] = useState<ContentForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const current = useMemo(
    () => items.find((item) => item.section_key === active) || null,
    [items, active]
  );

  const activeSection = useMemo(
    () => sections.find((section) => section.key === active),
    [active]
  );

  const load = async () => {
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await adminFetch("/api/admin/content");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "לא ניתן לטעון תוכן");
      }

      setItems(data.content || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "אירעה שגיאה בטעינת התוכן"
      );
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!current) {
      setForm(emptyForm);
      return;
    }

    const payload = current.payload || {};

    setForm({
      title: current.title || "",
      body: current.body || "",

      eyebrow: getPayloadString(payload, "eyebrow"),
      subtitle: getPayloadString(payload, "subtitle"),
      button_text: getPayloadString(payload, "button_text"),

      phone: getPayloadString(payload, "phone"),
      address: getPayloadString(payload, "address"),
      hours: getPayloadString(payload, "hours"),

      instagram_url: getPayloadString(payload, "instagram_url"),
      whatsapp_url: getPayloadString(payload, "whatsapp_url"),
      waze_url: getPayloadString(payload, "waze_url"),

      copyright_text: getPayloadString(payload, "copyright_text"),
    });
  }, [current]);

  function updateField<K extends keyof ContentForm>(
    field: K,
    value: ContentForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function buildPayload(): ContentPayload {
    const existingPayload = current?.payload || {};

    if (active === "hero") {
      return {
        ...existingPayload,
        eyebrow: form.eyebrow,
        subtitle: form.subtitle,
        button_text: form.button_text,
      };
    }

    if (active === "about") {
      return {
        ...existingPayload,
        eyebrow: form.eyebrow,
      };
    }

    if (active === "services") {
      return {
        ...existingPayload,
        eyebrow: form.eyebrow,
      };
    }

    if (active === "gallery") {
      return {
        ...existingPayload,
        eyebrow: form.eyebrow,
        instagram_url: form.instagram_url,
      };
    }

    if (active === "faq") {
      return {
        ...existingPayload,
        eyebrow: form.eyebrow,
      };
    }

    if (active === "contact") {
      return {
        ...existingPayload,
        eyebrow: form.eyebrow,
        phone: form.phone,
        address: form.address,
        hours: form.hours,
        instagram_url: form.instagram_url,
        whatsapp_url: form.whatsapp_url,
        waze_url: form.waze_url,
      };
    }

    if (active === "footer") {
      return {
        ...existingPayload,
        instagram_url: form.instagram_url,
        whatsapp_url: form.whatsapp_url,
        copyright_text: form.copyright_text,
      };
    }

    return existingPayload;
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await adminFetch("/api/admin/content", {
        method: "POST",
        body: JSON.stringify({
          section_key: active,
          title: form.title,
          body: form.body,
          payload: buildPayload(),
          is_active: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "לא ניתן לשמור תוכן");
      }

      setMessage("התוכן נשמר בהצלחה");
      setIsError(false);

      await load();

      setMessage("התוכן נשמר בהצלחה");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "אירעה שגיאה בשמירת התוכן"
      );
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="eyebrow">תוכן האתר</p>
          <h1>עריכת תוכן</h1>
          <p>
            כאן ניתן לשנות את הכותרות, הטקסטים ופרטי יצירת הקשר
            שמופיעים באתר.
          </p>
        </div>
      </div>

      {message ? (
        <div
          className={`panel info-box ${
            isError ? "error-box" : "success-box"
          }`}
          role="status"
        >
          {message}
        </div>
      ) : null}

      <div className="grid-2">
        <div className="stack">
          {sections.map((section) => (
            <button
              key={section.key}
              className={`section-card ${
                active === section.key ? "active" : ""
              }`}
              type="button"
              onClick={() => {
                setActive(section.key);
                setMessage("");
                setIsError(false);
              }}
            >
              <strong>{section.label}</strong>
              <span>{section.description}</span>
            </button>
          ))}
        </div>

        <form className="panel" onSubmit={save}>
          <div className="admin-form-header">
            <div>
              <p className="eyebrow">עריכת אזור</p>
              <h2>{activeSection?.label}</h2>
              <p>{activeSection?.description}</p>
            </div>
          </div>

          {loading ? (
            <p>טוען תוכן...</p>
          ) : (
            <>
              <label className="field">
                <span>כותרת</span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    updateField("title", event.target.value)
                  }
                  placeholder="הכנס כותרת"
                />
              </label>

              <label className="field">
                <span>תוכן</span>
                <textarea
                  rows={8}
                  value={form.body}
                  onChange={(event) =>
                    updateField("body", event.target.value)
                  }
                  placeholder="הכנס את תוכן האזור"
                />
              </label>

              {active === "hero" ? (
                <>
                  <label className="field">
                    <span>טקסט קטן מעל הכותרת</span>
                    <input
                      value={form.eyebrow}
                      onChange={(event) =>
                        updateField("eyebrow", event.target.value)
                      }
                      placeholder="לדוגמה: FAYGEN BARBER"
                    />
                  </label>

                  <label className="field">
                    <span>כותרת משנה</span>
                    <input
                      value={form.subtitle}
                      onChange={(event) =>
                        updateField("subtitle", event.target.value)
                      }
                      placeholder="לדוגמה: Where Style Begins"
                    />
                  </label>

                  <label className="field">
                    <span>טקסט בכפתור</span>
                    <input
                      value={form.button_text}
                      onChange={(event) =>
                        updateField("button_text", event.target.value)
                      }
                      placeholder="לדוגמה: קבע תור"
                    />
                  </label>
                </>
              ) : null}

              {active === "about" ||
              active === "services" ||
              active === "gallery" ||
              active === "faq" ||
              active === "contact" ? (
                <label className="field">
                  <span>טקסט קטן מעל הכותרת</span>
                  <input
                    value={form.eyebrow}
                    onChange={(event) =>
                      updateField("eyebrow", event.target.value)
                    }
                    placeholder="לדוגמה: לא עוד מספרה"
                  />
                </label>
              ) : null}

              {active === "gallery" ? (
                <label className="field">
                  <span>קישור לאינסטגרם</span>
                  <input
                    type="url"
                    dir="ltr"
                    value={form.instagram_url}
                    onChange={(event) =>
                      updateField(
                        "instagram_url",
                        event.target.value
                      )
                    }
                    placeholder="https://www.instagram.com/..."
                  />
                </label>
              ) : null}

              {active === "contact" ? (
                <>
                  <label className="field">
                    <span>מספר טלפון</span>
                    <input
                      type="tel"
                      dir="ltr"
                      value={form.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      placeholder="052-208-3902"
                    />
                  </label>

                  <label className="field">
                    <span>כתובת</span>
                    <input
                      value={form.address}
                      onChange={(event) =>
                        updateField("address", event.target.value)
                      }
                      placeholder="הירקון 18, באר יעקב"
                    />
                  </label>

                  <label className="field">
                    <span>שעות פעילות</span>
                    <textarea
                      rows={4}
                      value={form.hours}
                      onChange={(event) =>
                        updateField("hours", event.target.value)
                      }
                      placeholder={
                        "א׳–ה׳ 09:00–20:00\nו׳ 09:00–14:00"
                      }
                    />
                  </label>

                  <label className="field">
                    <span>קישור לאינסטגרם</span>
                    <input
                      type="url"
                      dir="ltr"
                      value={form.instagram_url}
                      onChange={(event) =>
                        updateField(
                          "instagram_url",
                          event.target.value
                        )
                      }
                      placeholder="https://www.instagram.com/..."
                    />
                  </label>

                  <label className="field">
                    <span>קישור לוואטסאפ</span>
                    <input
                      type="url"
                      dir="ltr"
                      value={form.whatsapp_url}
                      onChange={(event) =>
                        updateField(
                          "whatsapp_url",
                          event.target.value
                        )
                      }
                      placeholder="https://wa.me/972..."
                    />
                  </label>

                  <label className="field">
                    <span>קישור ל־Waze</span>
                    <input
                      type="url"
                      dir="ltr"
                      value={form.waze_url}
                      onChange={(event) =>
                        updateField("waze_url", event.target.value)
                      }
                      placeholder="https://waze.com/ul?..."
                    />
                  </label>
                </>
              ) : null}

              {active === "footer" ? (
                <>
                  <label className="field">
                    <span>טקסט זכויות יוצרים</span>
                    <input
                      value={form.copyright_text}
                      onChange={(event) =>
                        updateField(
                          "copyright_text",
                          event.target.value
                        )
                      }
                      placeholder="© 2026 FAYGEN BARBER. כל הזכויות שמורות."
                    />
                  </label>

                  <label className="field">
                    <span>קישור לאינסטגרם</span>
                    <input
                      type="url"
                      dir="ltr"
                      value={form.instagram_url}
                      onChange={(event) =>
                        updateField(
                          "instagram_url",
                          event.target.value
                        )
                      }
                      placeholder="https://www.instagram.com/..."
                    />
                  </label>

                  <label className="field">
                    <span>קישור לוואטסאפ</span>
                    <input
                      type="url"
                      dir="ltr"
                      value={form.whatsapp_url}
                      onChange={(event) =>
                        updateField(
                          "whatsapp_url",
                          event.target.value
                        )
                      }
                      placeholder="https://wa.me/972..."
                    />
                  </label>
                </>
              ) : null}

              <button
                className="button"
                type="submit"
                disabled={saving}
              >
                {saving ? "שומר שינויים..." : "שמור שינויים"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}