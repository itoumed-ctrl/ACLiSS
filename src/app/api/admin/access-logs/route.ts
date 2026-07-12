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
    // 「容器詳細（バーコード・容器一覧・検査項目検索のいずれから開いても対象）」と
    // 「管理画面に入った時」に絞る。トップページ・容器一覧・検査項目検索の
    // 一覧表示自体は件数が多くなりすぎるため除外する。
    // or()フィルタのlikeパターンはワイルドカードの扱いが分かりにくいため、
    // 条件ごとに分けて取得し、アプリ側でまとめて新しい順に並べ替える。
    const select = "id, accessed_at, path, ip_address, user_agent, device_id, event";
    const [adminLogs, containerDetailLogs] = await Promise.all([
      supabaseAdmin
        .from("access_logs")
        .select(select)
        .eq("path", "/admin")
        .order("accessed_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("access_logs")
        .select(select)
        .like("path", "/containers/%")
        .order("accessed_at", { ascending: false })
        .limit(50),
    ]);

    if (adminLogs.error) {
      return NextResponse.json({ error: adminLogs.error.message }, { status: 500 });
    }
    if (containerDetailLogs.error) {
      return NextResponse.json({ error: containerDetailLogs.error.message }, { status: 500 });
    }

    const data = [...(adminLogs.data ?? []), ...(containerDetailLogs.data ?? [])]
      .sort((a, b) => (a.accessed_at < b.accessed_at ? 1 : -1))
      .slice(0, 50);

    return NextResponse.json(data);
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
