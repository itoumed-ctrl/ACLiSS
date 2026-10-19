import { NextResponse } from "next/server";
import Papa from "papaparse";
import { checkAdminPasscode, getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  type ContainerRow,
  type TestItemRow,
  toContainerRecord,
  toTestItemRecord,
} from "@/lib/masterCsv";

export async function POST(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const formData = await request.formData();
  const type = formData.get("type");
  const file = formData.get("file");
  const importedBy = formData.get("importedBy");

  if (type !== "containers" && type !== "test_items") {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const text = await file.text();
  const sourceFileName = file.name;
  const parsed = Papa.parse<ContainerRow & TestItemRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      { error: "CSVの解析に失敗しました", details: parsed.errors },
      { status: 400 },
    );
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
    if (type === "containers") {
      const records = parsed.data
        .map(toContainerRecord)
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const { error } = await supabaseAdmin
        .from("containers")
        .upsert(records, { onConflict: "container_code" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await supabaseAdmin.from("import_logs").insert({
        imported_by: typeof importedBy === "string" ? importedBy : null,
        source_file_name: sourceFileName,
        containers_count: records.length,
        test_items_count: 0,
        note: "containers CSV import",
      });

      return NextResponse.json({ imported: records.length });
    }

    const records = parsed.data
      .map(toTestItemRecord)
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const { error } = await supabaseAdmin
      .from("test_items")
      .upsert(records, { onConflict: "test_item_code" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from("import_logs").insert({
      imported_by: typeof importedBy === "string" ? importedBy : null,
      source_file_name: sourceFileName,
      containers_count: 0,
      test_items_count: records.length,
      note: "test_items CSV import",
    });

    return NextResponse.json({ imported: records.length });
  } catch (e) {
    // Supabaseへの接続情報（service_roleキー等）が壊れている場合、ここで
    // supabase-js自体が例外を投げることがある。生の例外を返さず、
    // Vercel環境変数の確認を促すメッセージにする。
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
