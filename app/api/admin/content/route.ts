import { NextRequest, NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

const ALLOWED_SECTIONS = new Set([
  "hero",
  "about",
  "services",
  "gallery",
  "faq",
  "contact",
  "footer",
]);

type ContentRequestBody = {
  section_key?: unknown;
  title?: unknown;
  body?: unknown;
  payload?: unknown;
  is_active?: unknown;
};

function normalizeText(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    return undefined;
  }

  return normalized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAdminContext(req);

    if (!ctx) {
      return NextResponse.json(
        { error: "גישה נדחתה" },
        { status: 403 }
      );
    }

    const { data, error } = await ctx.db
      .from("website_content")
      .select(
        "id, section_key, title, body, payload, is_active, created_at, updated_at"
      )
      .order("section_key", { ascending: true });

    if (error) {
      console.error("GET /api/admin/content:", error);

      return NextResponse.json(
        { error: "לא ניתן לטעון תוכן" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { content: data ?? [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/admin/content unexpected error:", error);

    return NextResponse.json(
      { error: "אירעה שגיאה בלתי צפויה" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAdminContext(req);

    if (!ctx) {
      return NextResponse.json(
        { error: "גישה נדחתה" },
        { status: 403 }
      );
    }

    let input: ContentRequestBody;

    try {
      input = (await req.json()) as ContentRequestBody;
    } catch {
      return NextResponse.json(
        { error: "הבקשה אינה בפורמט JSON תקין" },
        { status: 400 }
      );
    }

    const sectionKey =
      typeof input.section_key === "string"
        ? input.section_key.trim().toLowerCase()
        : "";

    if (!ALLOWED_SECTIONS.has(sectionKey)) {
      return NextResponse.json(
        { error: "אזור התוכן אינו תקין" },
        { status: 400 }
      );
    }

    const title = normalizeText(input.title, 200);
    const body = normalizeText(input.body, 20000);

    if (title === undefined) {
      return NextResponse.json(
        { error: "הכותרת אינה תקינה או ארוכה מדי" },
        { status: 400 }
      );
    }

    if (body === undefined) {
      return NextResponse.json(
        { error: "התוכן אינו תקין או ארוך מדי" },
        { status: 400 }
      );
    }

    const payload = input.payload ?? {};

    if (!isPlainObject(payload)) {
      return NextResponse.json(
        { error: "הנתונים הנוספים חייבים להיות אובייקט JSON" },
        { status: 400 }
      );
    }

    const isActive =
      typeof input.is_active === "boolean"
        ? input.is_active
        : true;

    const { data, error } = await ctx.db
      .from("website_content")
      .upsert(
        {
          section_key: sectionKey,
          title,
          body,
          payload,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "section_key",
        }
      )
      .select(
        "id, section_key, title, body, payload, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("POST /api/admin/content:", error);

      return NextResponse.json(
        { error: "לא ניתן לשמור תוכן" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        content: data,
        message: "התוכן נשמר בהצלחה",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/admin/content unexpected error:", error);

    return NextResponse.json(
      { error: "אירעה שגיאה בלתי צפויה" },
      { status: 500 }
    );
  }
}