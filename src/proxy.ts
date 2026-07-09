import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { logAccess } from "@/lib/supabase-admin";

/**
 * 閲覧側画面のアクセスをログに記録する（アクセス制限は行わない）。
 * 閲覧側に認証をかけていない運用上のトレードオフを補うため、
 * 不審なアクセスがないか管理画面から確認できるようにするのが目的。
 * ログ記録は event.waitUntil で応答後に行い、表示速度に影響させない。
 */
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");

  event.waitUntil(
    logAccess({
      path: request.nextUrl.pathname,
      ipAddress,
      userAgent,
    }),
  );

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/scan", "/containers/:path*", "/search", "/admin"],
};
