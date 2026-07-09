import { NextResponse } from "next/server";
import { checkAdminPasscode, getSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "container-images";

export async function POST(request: Request) {
  const passcode = request.headers.get("x-admin-passcode");
  if (!(await checkAdminPasscode(passcode))) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const formData = await request.formData();
  const containerCode = formData.get("containerCode");
  const file = formData.get("file");

  if (typeof containerCode !== "string" || !containerCode.trim() || !(file instanceof File)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const code = containerCode.trim();
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${code}.${extension}`;

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
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path);

    // 同じ写真を使い回している容器（image_source_code が一致する行）にも
    // まとめて反映する。マスタ未取り込みで image_source_code が空の場合は、
    // container_code が一致する自分自身の行にだけ反映する（従来どおりの挙動）。
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("containers")
      .update({ image_url: publicUrlData.publicUrl })
      .or(
        `image_source_code.eq.${code},and(image_source_code.is.null,container_code.eq.${code})`,
      )
      .select("container_code");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: `容器コード "${code}" が容器マスタに見つかりません` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      imageUrl: publicUrlData.publicUrl,
      updatedContainerCodes: updated.map((r) => r.container_code),
    });
  } catch (e) {
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
