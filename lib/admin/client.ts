import { createClient } from "@/lib/supabase/client";

export async function adminFetch(
  path: string,
  init: RequestInit = {}
) {
  const db = createClient();

  if (!db) {
    throw new Error("Supabase is not configured");
  }

  const {
    data: { session },
  } = await db.auth.getSession();

  const headers = new Headers(init.headers || {});

  const isFormData = init.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (session?.access_token) {
    headers.set(
      "Authorization",
      `Bearer ${session.access_token}`
    );
  }

  return fetch(path, {
    ...init,
    headers,
  });
}