import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import type { TestItem } from "@/lib/types";

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("test_items")
    .select("*")
    .order("test_item_code");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as TestItem[]);
}
