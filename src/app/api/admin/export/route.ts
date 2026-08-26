import { NextResponse } from "next/server";
import Papa from "papaparse";
import { checkAdminPasscode, getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Container, TestItem } from "@/lib/types";

// /api/admin/import が読み取る列名・順序と完全に一致させる。
// image_url（写真アップロード専用の列）とupdated_at（サーバー管理）は
// CSV一括更新の対象外のため含めない。
const CONTAINER_COLUMNS = [
  "container_code",
  "vessel",
  "material",
  "dispense_location",
  "dispense_phs",
  "inquiry_dept",
  "inquiry_phs",
  "item_count",
  "collection_amount",
  "representative_item_code",
  "test_summary",
  "has_instruction",
  "instruction_1",
  "instruction_2",
  "instruction_3",
  "notes",
  "image_path_raw",
  "image_source_code",
];

const TEST_ITEM_COLUMNS = ["test_item_code", "test_item_name", "container_code"];

function toContainerCsvRow(c: Container): Record<string, string> {
  return {
    container_code: c.container_code,
    vessel: c.vessel ?? "",
    material: c.material ?? "",
    dispense_location: c.dispense_location ?? "",
    dispense_phs: c.dispense_phs ?? "",
    inquiry_dept: c.inquiry_dept ?? "",
    inquiry_phs: c.inquiry_phs ?? "",
    item_count: c.item_count != null ? String(c.item_count) : "",
    collection_amount: c.collection_amount ?? "",
    representative_item_code: c.representative_item_code ?? "",
    test_summary: c.test_summary ?? "",
    // インポート側は "1" のみを真として扱うため、それに合わせる。
    has_instruction: c.has_instruction ? "1" : "",
    instruction_1: c.instruction_1 ?? "",
    instruction_2: c.instruction_2 ?? "",
    instruction_3: c.instruction_3 ?? "",
    notes: c.notes ?? "",
    image_path_raw: c.image_path_raw ?? "",
    image_source_code: c.image_source_code ?? "",
  };
}

function toTestItemCsvRow(t: TestItem): Record<string, string> {
  return {
    test_item_code: t.test_item_code,
    test_item_name: t.test_item_name,
    container_code: t.container_code ?? "",
  };
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvResponse(fields: string[], rows: Record<string, string>[], filenamePrefix: string) {
  const csv = Papa.unparse({ fields, data: rows });
  // ExcelでUTF-8のCSVを開むと文字化けすることがあるため、BOMを付与する
  // （取り込み側のpapaparseはBOMを自動で読み飛ばすため、そのまま再アップロードできる）。
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filenamePrefix}_${todayStamp()}.csv"`,
    },
  });
}

export async function GET(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type !== "containers" && type !== "test_items") {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
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

  if (type === "containers") {
    const { data, error } = await supabaseAdmin
      .from("containers")
      .select("*")
      .order("container_code");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = ((data ?? []) as Container[]).map(toContainerCsvRow);
    return csvResponse(CONTAINER_COLUMNS, rows, "acliss_containers");
  }

  const { data, error } = await supabaseAdmin
    .from("test_items")
    .select("*")
    .order("test_item_code");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = ((data ?? []) as TestItem[]).map(toTestItemCsvRow);
  return csvResponse(TEST_ITEM_COLUMNS, rows, "acliss_test_items");
}
