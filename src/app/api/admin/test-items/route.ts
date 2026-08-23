import { NextResponse } from "next/server";
import { checkAdminPasscode, getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const testItemCode = typeof body?.test_item_code === "string" ? body.test_item_code.trim() : "";
  const testItemName = typeof body?.test_item_name === "string" ? body.test_item_name.trim() : "";
  if (!testItemCode || !testItemName) {
    return NextResponse.json(
      { error: "検査項目コードと検査項目名は必須です" },
      { status: 400 },
    );
  }

  const containerCode =
    typeof body?.container_code === "string" && body.container_code.trim()
      ? body.container_code.trim()
      : null;

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "サーバー設定エラー" },
      { status: 500 },
    );
  }

  const { error } = await supabaseAdmin.from("test_items").upsert(
    {
      test_item_code: testItemCode,
      test_item_name: testItemName,
      container_code: containerCode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "test_item_code" },
  );

  if (error) {
    // 23503 = 外部キー制約違反。指定した容器コードが容器マスタに存在しない場合。
    if (error.code === "23503") {
      return NextResponse.json(
        { error: `容器コード "${containerCode}" は容器マスタに存在しません。先に容器マスタへ追加してください。` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
