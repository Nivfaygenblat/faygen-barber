"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/client";

type VersionItem = {
  id: string;
  section: string;
  change_type: string;
  description: string | null;
  created_at: string;
  snapshot: Record<string, unknown>;
};

export default function VersionsPage() {
  const [items, setItems] = useState<VersionItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const res = await adminFetch("/api/admin/versions");
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "לא ניתן לטעון גרסאות");
      } else {
        setItems(data.versions || []);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="eyebrow">היסטוריית גרסאות</p>
          <h1>רשימת שינויים</h1>
        </div>
      </div>

      {message ? <div className="panel info-box">{message}</div> : null}

      <div className="stack">
        {items.map((item) => (
          <div key={item.id} className="panel card-row">
            <div>
              <strong>{item.description || item.change_type}</strong>
              <p>{item.section} · {item.change_type}</p>
            </div>
            <div className="chip">{new Date(item.created_at).toLocaleString("he-IL")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
