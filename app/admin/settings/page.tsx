"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/client";

type SettingsState = {
  business_name: string;
  phone: string;
  email: string;
  address: string;
  whatsapp: string;
  instagram_url: string;
  business_hours: string;
  hero_title: string;
  hero_subtitle: string;
  about_title: string;
  about_body: string;
  footer_text: string;
};

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsState>({
    business_name: "",
    phone: "",
    email: "",
    address: "",
    whatsapp: "",
    instagram_url: "",
    business_hours: "",
    hero_title: "",
    hero_subtitle: "",
    about_title: "",
    about_body: "",
    footer_text: "",
  });
  const [message, setMessage] = useState("");

  const load = async () => {
    const res = await adminFetch("/api/admin/settings");
    const data = await res.json();
    if (res.ok && data.settings?.[0]) {
      setForm({ ...form, ...data.settings[0] });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "לא ניתן לשמור הגדרות");
    } else {
      setMessage("ההגדרות נשמרו");
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="eyebrow">הגדרות העסק</p>
          <h1>פרטי העסק</h1>
        </div>
      </div>

      {message ? <div className="panel info-box">{message}</div> : null}

      <form className="panel" onSubmit={save}>
        <div className="grid-2">
          {Object.entries({
            business_name: "שם העסק",
            phone: "טלפון",
            email: "אימייל",
            address: "כתובת",
            whatsapp: "WhatsApp",
            instagram_url: "Instagram",
            business_hours: "שעות פעילות",
            hero_title: "כותרת ראשית",
            hero_subtitle: "תת־כותרת",
            about_title: "כותרת עליי",
            about_body: "תוכן עליי",
            footer_text: "פוטר",
          }).map(([key, label]) => (
            <label key={key} className="field">
              <span>{label}</span>
              <input value={(form as Record<string, string>)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value } as SettingsState)} />
            </label>
          ))}
        </div>
        <button className="button" type="submit">שמור שינויים</button>
      </form>
    </div>
  );
}

