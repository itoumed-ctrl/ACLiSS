import { NextResponse } from "next/server";
import { checkAdminPasscode, getSupabaseAdminClient } from "@/lib/supabase-admin";

function trimOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// 容器を1件ずつ追加・編集する。image_url/image_path_rawは写真アップロード機能
// (upload-image, bulk-upload-image) 専用の列のため、ここでは一切触れない。
// upsertは渡した列だけをSET句に含めるため、含めなければ既存の値がそのまま残る。
export async function POST(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const containerCode = trimOrNull(body?.container_code);
  if (!containerCode) {
    return NextResponse.json({ error: "容器コードは必須です" }, { status: 400 });
  }

  const itemCount =
    body.item_count === "" || body.item_count === null || body.item_count === undefined
      ? null
      : Number(body.item_count);
  if (itemCount !== null && !Number.isFinite(itemCount)) {
    return NextResponse.json({ error: "該当項目数は数値で入力してください" }, { status: 400 });
  }

  const record = {
    container_code: containerCode,
    vessel: trimOrNull(body.vessel),
    material: trimOrNull(body.material),
    dispense_location: trimOrNull(body.dispense_location),
    dispense_phs: trimOrNull(body.dispense_phs),
    inquiry_dept: trimOrNull(body.inquiry_dept),
    inquiry_phs: trimOrNull(body.inquiry_phs),
    item_count: itemCount,
    collection_amount: trimOrNull(body.collection_amount),
    representative_item_code: trimOrNull(body.representative_item_code),
    test_summary: trimOrNull(body.test_summary),
    has_instruction: Boolean(body.has_instruction),
    instruction_1: trimOrNull(body.instruction_1),
    instruction_2: trimOrNull(body.instruction_2),
    instruction_3: trimOrNull(body.instruction_3),
    notes: trimOrNull(body.notes),
    updated_at: new Date().toISOString(),
  };

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "サーバー設定エラー" },
      { status: 500 },
    );
  }

  const { error } = await supabaseAdmin
    .from("containers")
    .upsert(record, { onConflict: "container_code" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
