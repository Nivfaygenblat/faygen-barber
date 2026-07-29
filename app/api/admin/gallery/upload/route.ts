import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getExtension(file: File) {
  const extensionFromName = file.name
    .split(".")
    .pop()
    ?.toLowerCase();

  if (
    extensionFromName &&
    ["jpg", "jpeg", "png", "webp"].includes(
      extensionFromName
    )
  ) {
    return extensionFromName === "jpeg"
      ? "jpg"
      : extensionFromName;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

export async function POST(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx) {
    return NextResponse.json(
      { error: "גישה נדחתה" },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "לא נבחרה תמונה" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            "ניתן להעלות רק תמונות JPG, PNG או WEBP",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error:
            "גודל התמונה לא יכול להיות גדול מ־5MB",
        },
        { status: 400 }
      );
    }

    const extension = getExtension(file);
    const filePath = `versions/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { error: uploadError } =
      await ctx.db.storage
        .from("gallery")
        .upload(filePath, fileBuffer, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "Failed to upload gallery image:",
        uploadError
      );

      return NextResponse.json(
        { error: "לא ניתן להעלות את התמונה" },
        { status: 500 }
      );
    }

    const { data: publicUrlData } =
      ctx.db.storage
        .from("gallery")
        .getPublicUrl(filePath);

    return NextResponse.json({
      ok: true,
      image_url: publicUrlData.publicUrl,
      storage_path: filePath,
    });
  } catch (error) {
    console.error(
      "Gallery upload request failed:",
      error
    );

    return NextResponse.json(
      { error: "אירעה שגיאה בהעלאת התמונה" },
      { status: 500 }
    );
  }
}