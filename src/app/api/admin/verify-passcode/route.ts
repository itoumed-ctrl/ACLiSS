import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkAdminPasscode, logAccess } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  // 「/adminを開いた」だけのログとは別に、実際に合言葉認証が通った
  // タイミングも分かるように記録する（不審なアクセスの確認用）。
  await logAccess({
    path: "/admin",
    event: "admin_login_success",
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
