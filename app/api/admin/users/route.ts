import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

type AllowedRole = "manager" | "admin";

type CreateUserBody = {
  full_name?: string;
  phone?: string;
  email?: string;
  password?: string;
  role?: AllowedRole;
};

type UpdateUserBody = {
  id?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  password?: string;
  role?: AllowedRole;
  is_active?: boolean;
};

type DeleteUserBody = {
  id?: string;
};

const MANAGEMENT_ROLES = ["owner", "manager"];

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedRole(value: unknown): value is AllowedRole {
  return value === "manager" || value === "admin";
}

function canManageUsers(role: string) {
  return MANAGEMENT_ROLES.includes(role);
}

async function countActiveManagers(
  db: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["db"],
  excludedUserId?: string
) {
  let query = db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "manager")
    .eq("is_active", true);

  if (excludedUserId) {
    query = query.neq("id", excludedUserId);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Count managers error:", error);
    return null;
  }

  return count ?? 0;
}

export async function GET(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx || !canManageUsers(ctx.role)) {
    return NextResponse.json(
      { error: "אין לך הרשאה לצפות במנהלים" },
      { status: 403 }
    );
  }

  const { data, error } = await ctx.db
    .from("profiles")
    .select(
      "id,email,full_name,phone,role,is_active,created_at,last_login_at"
    )
    .in("role", ["owner", "manager", "admin"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("GET /api/admin/users:", error);

    return NextResponse.json(
      { error: "לא ניתן לטעון משתמשים" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    users: data || [],
    currentUserId: ctx.user.id,
    currentUserRole: ctx.role,
  });
}

export async function POST(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx || !canManageUsers(ctx.role)) {
    return NextResponse.json(
      { error: "אין לך הרשאה להוסיף מנהלים" },
      { status: 403 }
    );
  }

  let body: CreateUserBody;

  try {
    body = (await req.json()) as CreateUserBody;
  } catch {
    return NextResponse.json(
      { error: "הבקשה אינה תקינה" },
      { status: 400 }
    );
  }

  const fullName = normalizeText(body.full_name);
  const phone = normalizeText(body.phone);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;

  if (fullName.length < 2) {
    return NextResponse.json(
      { error: "יש להזין שם מלא" },
      { status: 400 }
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "יש להזין כתובת אימייל תקינה" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "הסיסמה חייבת להכיל לפחות 6 תווים" },
      { status: 400 }
    );
  }

  if (!isAllowedRole(role)) {
    return NextResponse.json(
      { error: "סוג המנהל אינו תקין" },
      { status: 400 }
    );
  }

  const { data: existingProfile } = await ctx.db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json(
      { error: "כבר קיים משתמש עם כתובת האימייל הזאת" },
      { status: 409 }
    );
  }

  const { data: authData, error: authError } =
    await ctx.db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
      },
    });

  if (authError || !authData.user) {
    console.error("Create auth user error:", authError);

    const message =
      authError?.message?.toLowerCase().includes("already")
        ? "כבר קיים משתמש עם כתובת האימייל הזאת"
        : "לא ניתן ליצור את המשתמש";

    return NextResponse.json(
      { error: message },
      { status: authError?.message?.toLowerCase().includes("already") ? 409 : 500 }
    );
  }

  const newUserId = authData.user.id;

  const { data: profile, error: profileError } = await ctx.db
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        email,
        full_name: fullName,
        phone: phone || null,
        role,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      }
    )
    .select(
      "id,email,full_name,phone,role,is_active,created_at,last_login_at"
    )
    .single();

  if (profileError) {
    console.error("Create profile error:", profileError);

    await ctx.db.auth.admin.deleteUser(newUserId);

    return NextResponse.json(
      { error: "המשתמש לא נשמר. הפעולה בוטלה" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      message: "המנהל נוסף בהצלחה",
      user: profile,
    },
    { status: 201 }
  );
}

export async function PATCH(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx || !canManageUsers(ctx.role)) {
    return NextResponse.json(
      { error: "אין לך הרשאה לערוך מנהלים" },
      { status: 403 }
    );
  }

  let body: UpdateUserBody;

  try {
    body = (await req.json()) as UpdateUserBody;
  } catch {
    return NextResponse.json(
      { error: "הבקשה אינה תקינה" },
      { status: 400 }
    );
  }

  const targetId = normalizeText(body.id);

  if (!targetId) {
    return NextResponse.json(
      { error: "חסר מזהה משתמש" },
      { status: 400 }
    );
  }

  const { data: target, error: targetError } = await ctx.db
    .from("profiles")
    .select("id,email,full_name,phone,role,is_active")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json(
      { error: "המשתמש לא נמצא" },
      { status: 404 }
    );
  }

  /*
   * אף אחד, כולל מנהל המערכת עצמו,
   * לא משנה את תפקיד ה-owner דרך המסך.
   * כך נשמר תמיד מנהל מערכת יחיד ומוגן.
   */
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "לא ניתן לשנות את מנהל המערכת" },
      { status: 403 }
    );
  }

  const requestedRole =
    body.role === undefined ? target.role : body.role;

  if (!isAllowedRole(requestedRole)) {
    return NextResponse.json(
      { error: "סוג המנהל אינו תקין" },
      { status: 400 }
    );
  }

  /*
   * אם מורידים מנהל עסק למנהל רגיל,
   * חייב להישאר לפחות מנהל עסק פעיל אחד.
   */
  if (
    target.role === "manager" &&
    requestedRole !== "manager" &&
    target.is_active !== false
  ) {
    const remainingManagers = await countActiveManagers(
      ctx.db,
      target.id
    );

    if (remainingManagers === null) {
      return NextResponse.json(
        { error: "לא ניתן לבדוק את מספר מנהלי העסק" },
        { status: 500 }
      );
    }

    if (remainingManagers < 1) {
      return NextResponse.json(
        {
          error:
            "לא ניתן לשנות את התפקיד. חייב להישאר לפחות מנהל עסק פעיל אחד",
        },
        { status: 400 }
      );
    }
  }

  /*
   * גם השעיית מנהל העסק האחרון אסורה.
   */
  if (
    target.role === "manager" &&
    target.is_active !== false &&
    body.is_active === false
  ) {
    const remainingManagers = await countActiveManagers(
      ctx.db,
      target.id
    );

    if (remainingManagers === null) {
      return NextResponse.json(
        { error: "לא ניתן לבדוק את מספר מנהלי העסק" },
        { status: 500 }
      );
    }

    if (remainingManagers < 1) {
      return NextResponse.json(
        {
          error:
            "לא ניתן להשעות את מנהל העסק האחרון",
        },
        { status: 400 }
      );
    }
  }

  const fullName =
    body.full_name === undefined
      ? target.full_name
      : normalizeText(body.full_name);

  const phone =
    body.phone === undefined
      ? target.phone
      : normalizeText(body.phone) || null;

  const email =
    body.email === undefined
      ? target.email
      : normalizeEmail(body.email);

  if (!fullName || fullName.length < 2) {
    return NextResponse.json(
      { error: "יש להזין שם מלא" },
      { status: 400 }
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "יש להזין כתובת אימייל תקינה" },
      { status: 400 }
    );
  }

  const authUpdates: {
    email?: string;
    password?: string;
    email_confirm?: boolean;
    user_metadata?: {
      full_name: string;
      phone: string | null;
    };
  } = {
    user_metadata: {
      full_name: fullName,
      phone,
    },
  };

  if (email !== target.email) {
    authUpdates.email = email;
    authUpdates.email_confirm = true;
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: "הסיסמה חייבת להכיל לפחות 6 תווים" },
        { status: 400 }
      );
    }

    authUpdates.password = body.password;
  }

  const { error: authError } =
    await ctx.db.auth.admin.updateUserById(
      target.id,
      authUpdates
    );

  if (authError) {
    console.error("Update auth user error:", authError);

    return NextResponse.json(
      {
        error: authError.message.toLowerCase().includes("already")
          ? "כבר קיים משתמש עם כתובת האימייל הזאת"
          : "לא ניתן לעדכן את פרטי ההתחברות",
      },
      { status: 400 }
    );
  }

  const { data: updatedProfile, error: profileError } =
    await ctx.db
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        email,
        role: requestedRole,
        is_active:
          body.is_active === undefined
            ? target.is_active
            : body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .select(
        "id,email,full_name,phone,role,is_active,created_at,last_login_at"
      )
      .single();

  if (profileError) {
    console.error("Update profile error:", profileError);

    return NextResponse.json(
      { error: "פרטי ההתחברות עודכנו, אך הפרופיל לא נשמר" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "פרטי המנהל עודכנו בהצלחה",
    user: updatedProfile,
  });
}

export async function DELETE(req: Request) {
  const ctx = await getAdminContext(req);

  if (!ctx || !canManageUsers(ctx.role)) {
    return NextResponse.json(
      { error: "אין לך הרשאה למחוק מנהלים" },
      { status: 403 }
    );
  }

  let body: DeleteUserBody;

  try {
    body = (await req.json()) as DeleteUserBody;
  } catch {
    return NextResponse.json(
      { error: "הבקשה אינה תקינה" },
      { status: 400 }
    );
  }

  const targetId = normalizeText(body.id);

  if (!targetId) {
    return NextResponse.json(
      { error: "חסר מזהה משתמש" },
      { status: 400 }
    );
  }

  if (targetId === ctx.user.id) {
    return NextResponse.json(
      { error: "לא ניתן למחוק את החשבון שאיתו אתה מחובר" },
      { status: 400 }
    );
  }

  const { data: target, error: targetError } = await ctx.db
    .from("profiles")
    .select("id,full_name,email,role,is_active")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json(
      { error: "המשתמש לא נמצא" },
      { status: 404 }
    );
  }

  if (target.role === "owner") {
    return NextResponse.json(
      { error: "לא ניתן למחוק את מנהל המערכת" },
      { status: 403 }
    );
  }

  if (target.role === "manager" && target.is_active !== false) {
    const remainingManagers = await countActiveManagers(
      ctx.db,
      target.id
    );

    if (remainingManagers === null) {
      return NextResponse.json(
        { error: "לא ניתן לבדוק את מספר מנהלי העסק" },
        { status: 500 }
      );
    }

    if (remainingManagers < 1) {
      return NextResponse.json(
        {
          error:
            "לא ניתן למחוק את מנהל העסק האחרון. חייב להישאר לפחות מנהל עסק פעיל אחד",
        },
        { status: 400 }
      );
    }
  }

  const { error: deleteError } =
    await ctx.db.auth.admin.deleteUser(target.id);

  if (deleteError) {
    console.error("Delete auth user error:", deleteError);

    return NextResponse.json(
      { error: "לא ניתן למחוק את המשתמש" },
      { status: 500 }
    );
  }

  /*
   * לפי מבנה הטבלה שלך, מחיקת המשתמש מ-auth.users
   * מוחקת אוטומטית את profiles באמצעות ON DELETE CASCADE.
   */

  return NextResponse.json({
    message: "המנהל נמחק בהצלחה",
  });
}