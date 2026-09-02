import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * SupabaseのFreeプランは、7日間APIアクセスが無いとプロジェクトが自動的に
 * 一時停止（pause）される。院内での利用が数日空くこともあり得るため、
 * Vercel Cron（vercel.jsonで1日1回に設定）からこのエンドポイントを叩き、
 * 軽いSELECTを1回実行することでアクセス実績を作り、一時停止を防ぐ。
 *
 * Vercelの環境変数にCRON_SECRETを設定しておくと、Vercel Cronからの
 * リクエストには自動的に `Authorization: Bearer <CRON_SECRET>` が
 * 付与されるため、それ以外からの呼び出しを弾ける。未設定の場合は
 * （開発環境などでは）認証をスキップする。
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "認証エラー" }, { status: 401 });
    }
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("containers")
      .select("container_code")
      .limit(1);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "サーバー設定エラー" },
      { status: 500 },
    );
  }
}
