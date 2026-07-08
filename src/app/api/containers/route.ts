import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import type { Container } from "@/lib/types";

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .order("container_code");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as Container[]);
}
