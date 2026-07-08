import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import type { Container } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .eq("container_code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: `容器コード "${code}" が見つかりません` },
      { status: 404 },
    );
  }

  return NextResponse.json(data as Container);
}
