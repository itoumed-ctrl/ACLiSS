import { NextResponse } from "next/server";
import { checkAdminPasscode, getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const { code } = await params;

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "サーバー設定エラー" },
      { status: 500 },
    );
  }

  const { error } = await supabaseAdmin.from("containers").delete().eq("container_code", code);

  if (error) {
    // 23503 = 外部キー制約違反。この容器コードを参照している検査項目が残っている場合。
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "この容器コードを使っている検査項目があるため削除できません。先に該当する検査項目を削除するか、検査項目側の容器コードを変更してください。",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
