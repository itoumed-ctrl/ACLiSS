import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REALM = "ACLiSS";
const VIEWER_USER = "acliss";

export default function proxy(request: NextRequest) {
  const passcode = process.env.VIEWER_PASSCODE;

  // 合言葉が未設定のまま公開してしまう事故を防ぐため、未設定時は認証をスキップせずエラーにする。
  if (!passcode) {
    return new NextResponse("VIEWER_PASSCODE が未設定です。管理者に連絡してください。", {
      status: 500,
    });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const inputUser = decoded.slice(0, separatorIndex);
    const inputPass = decoded.slice(separatorIndex + 1);
    if (inputUser === VIEWER_USER && inputPass === passcode) {
      return NextResponse.next();
    }
  }

  return new NextResponse("認証が必要です", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}"`,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
