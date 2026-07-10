import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logAccess } from "@/lib/supabase-admin";

/**
 * 閲覧側画面のアクセスをログに記録する（アクセス制限は行わない）。
 * 閲覧側に認証をかけていない運用上のトレードオフを補うため、
 * 不審なアクセスがないか管理画面から確認できるようにするのが目的。
 *
 * event.waitUntil は Node.jsランタイムのProxyでは応答送信後に処理が
 * 打ち切られ記録が完了しないことがあったため、確実に記録されるよう
 * ここで待ち受けてから応答する（多少の遅延より確実性を優先）。
 */
export default async function proxy(request: NextRequest) {
  // トップページのリンクは画面に表示された時点でNext.jsが裏側で
  // 先読み（プリフェッチ）するため、実際に開いていないページまで
  // ログに記録されてしまう。プリフェッチのリクエストには専用のヘッダーが
  // 付く（ページ全体の先読みは next-router-prefetch、部分的な先読みは
  // next-router-segment-prefetch）ため、それらは記録の対象から除外する。
  // ブラウザ標準の投機的プリフェッチ（purpose/sec-purposeヘッダー）も同様に除外する。
  const isPrefetch =
    request.headers.get("next-router-prefetch") !== null ||
    request.headers.get("next-router-segment-prefetch") !== null ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch");

  if (!isPrefetch) {
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent");

    await logAccess({
      path: request.nextUrl.pathname,
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/scan", "/containers/:path*", "/search", "/admin"],
};
