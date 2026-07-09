import { NextResponse } from "next/server";
import Papa from "papaparse";
import { checkAdminPasscode, getSupabaseAdminClient } from "@/lib/supabase-admin";

type ContainerRow = {
  container_code?: string;
  vessel?: string;
  material?: string;
  dispense_location?: string;
  dispense_phs?: string;
  inquiry_dept?: string;
  inquiry_phs?: string;
  item_count?: string;
  collection_amount?: string;
  representative_item_code?: string;
  test_summary?: string;
  has_instruction?: string;
  instruction_1?: string;
  instruction_2?: string;
  instruction_3?: string;
  notes?: string;
  image_path_raw?: string;
  image_source_code?: string;
};

type TestItemRow = {
  test_item_code?: string;
  test_item_name?: string;
  container_code?: string;
};

function toContainerRecord(row: ContainerRow) {
  const containerCode = row.container_code?.trim();
  if (!containerCode) return null;

  const collectionAmount = row.collection_amount?.trim();

  return {
    container_code: containerCode,
    vessel: row.vessel?.trim() || null,
    material: row.material?.trim() || null,
    dispense_location: row.dispense_location?.trim() || null,
    dispense_phs: row.dispense_phs?.trim() || null,
    inquiry_dept: row.inquiry_dept?.trim() || null,
    inquiry_phs: row.inquiry_phs?.trim() || null,
    item_count: row.item_count ? Number(row.item_count) : null,
    collection_amount:
      collectionAmount === "----" ? "規定なし" : collectionAmount || null,
    representative_item_code: row.representative_item_code?.trim() || null,
    test_summary: row.test_summary?.trim() || null,
    has_instruction: row.has_instruction?.trim() === "1",
    instruction_1: row.instruction_1?.trim() || null,
    instruction_2: row.instruction_2?.trim() || null,
    instruction_3: row.instruction_3?.trim() || null,
    notes: row.notes?.trim() || null,
    image_path_raw: row.image_path_raw?.trim() || null,
    image_source_code: row.image_source_code?.trim() || null,
  };
}

function toTestItemRecord(row: TestItemRow) {
  const testItemCode = row.test_item_code?.trim();
  if (!testItemCode) return null;

  return {
    test_item_code: testItemCode,
    test_item_name: row.test_item_name?.trim() || "",
    container_code: row.container_code?.trim() || null,
  };
}

export async function POST(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const formData = await request.formData();
  const type = formData.get("type");
  const file = formData.get("file");
  const csvText = formData.get("csvText");
  const importedBy = formData.get("importedBy");

  if (type !== "containers" && type !== "test_items") {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  let text: string;
  let sourceFileName: string;
  if (file instanceof File) {
    text = await file.text();
    sourceFileName = file.name;
  } else if (typeof csvText === "string" && csvText.trim()) {
    text = csvText;
    sourceFileName = "貼り付けたテキスト";
  } else {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
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
