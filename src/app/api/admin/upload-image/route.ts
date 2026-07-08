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

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path);

  const { error: updateError } = await supabaseAdmin
    .from("containers")
    .update({ image_url: publicUrlData.publicUrl })
    .eq("container_code", code);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ imageUrl: publicUrlData.publicUrl });
}
