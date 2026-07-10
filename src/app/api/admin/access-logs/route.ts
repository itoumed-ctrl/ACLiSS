import { NextResponse } from "next/server";
import { checkAdminPasscode, getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "サーバー設定エラー" },
      { status: 500 },
    );
  }

  try {
    // 記録自体はsrc/proxy.tsで全ページ分行っているが、管理画面に表示するのは
    // 「各機能を使った時」（スキャン・容器一覧・検査項目検索）と「管理画面に入った時」に絞る。
    // 容器詳細（/containers/[code]）やトップページの表示は件数が多くなりすぎるため除外する。
    const { data, error } = await supabaseAdmin
      .from("access_logs")
      .select("id, accessed_at, path, ip_address, user_agent")
      .in("path", ["/scan", "/containers", "/search", "/admin"])
      .order("accessed_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
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
}
