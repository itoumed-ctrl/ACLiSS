import { NextResponse } from "next/server";
import { changeAdminPasscode, checkAdminPasscode } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const currentPasscode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(currentPasscode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const newPasscode = body?.newPasscode;

  if (typeof newPasscode !== "string" || newPasscode.length < 4) {
    return NextResponse.json(
      { error: "新しいパスワードは4文字以上にしてください" },
      { status: 400 },
    );
  }

  try {
    await changeAdminPasscode(newPasscode);
  } catch (e) {
    const message =
      e && typeof e === "object" && "message" in e && typeof e.message === "string"
        ? e.message
        : "変更に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
