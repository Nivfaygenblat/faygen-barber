"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/client";

type Activity = {
  id: string;
  description: string;
  action_type: string;
  section: string | null;
  created_at: string;
};

export default function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const res = await adminFetch("/api/admin/activity");
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "לא ניתן לטעון יומן פעילות");
      } else {
        setItems(data.activity || []);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="eyebrow">יומן פעילות</p>
          <h1>פעולות מערכת</h1>
        </div>
      </div>

      {message ? <div className="panel info-box">{message}</div> : null}

      <div className="stack">
        {items.map((item) => (
          <div key={item.id} className="panel card-row">
            <div>
              <strong>{item.description}</strong>
              <p>{item.action_type} · {item.section || "כללי"}</p>
            </div>
            <div className="chip">{new Date(item.created_at).toLocaleString("he-IL")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
