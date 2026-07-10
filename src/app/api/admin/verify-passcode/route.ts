import { NextResponse } from "next/server";
import { checkAdminPasscode } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
