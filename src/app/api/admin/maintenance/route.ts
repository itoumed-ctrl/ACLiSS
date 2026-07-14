import { NextResponse } from "next/server";
import {
  checkAdminPasscode,
  getMaintenanceStatus,
  setMaintenanceStatus,
} from "@/lib/supabase-admin";

// 現在のメンテナンス状態を取得（管理画面の表示用、合言葉必須）
export async function GET(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }
  const status = await getMaintenanceStatus();
  return NextResponse.json(status);
}

// メンテナンス状態を変更（合言葉必須）
export async function POST(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!passcode || !(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const enabled = Boolean(body?.enabled);
  const rawMessage = typeof body?.message === "string" ? body.message.trim() : "";
  const message = rawMessage.length > 0 ? rawMessage : null;

  try {
    await setMaintenanceStatus(enabled, message, passcode);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error:
          "Supabaseへの接続に失敗しました。Vercelの環境変数（特にSUPABASE_SERVICE_ROLE_KEY）が正しく設定されているか確認してください。詳細: " +
          detail,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, enabled, message });
}
