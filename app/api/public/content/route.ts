import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type WebsiteContentRow = {
  section_key: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
};

export async function GET() {
  try {
    const db = createServerClient();

    if (!db) {
      return NextResponse.json(
        { error: "לא ניתן להתחבר למסד הנתונים" },
        { status: 500 }
      );
    }

    const { data, error } = await db
      .from("website_content")
      .select("section_key, title, body, payload")
      .eq("is_active", true)
      .order("section_key", { ascending: true });

    if (error) {
      console.error("GET /api/public/content:", error);

      return NextResponse.json(
        { error: "לא ניתן לטעון את תוכן האתר" },
        { status: 500 }
      );
    }

    const rows = (data || []) as WebsiteContentRow[];

    const content = rows.reduce<
      Record<
        string,
        {
          title: string | null;
          body: string | null;
          payload: Record<string, unknown>;
        }
      >
    >((result, item) => {
      result[item.section_key] = {
        title: item.title,
        body: item.body,
        payload: item.payload || {},
      };

      return result;
    }, {});

    return NextResponse.json(
      { content },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/public/content unexpected error:", error);

    return NextResponse.json(
      { error: "אירעה שגיאה בלתי צפויה" },
      { status: 500 }
    );
  }
}