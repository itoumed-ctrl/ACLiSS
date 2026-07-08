import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

let client: SupabaseClient | null = null;

/**
 * 管理画面（マスタ更新）専用のSupabaseクライアント。service_roleキーを使い、
 * RLSを無視して書き込みできる。API Route（サーバー側）以外からは絶対に呼び出さないこと。
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local に設定してください（supabase/README.md 参照）。",
    );
  }
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }
  return client;
}

function hashPasscode(passcode: string): string {
  return createHash("sha256").update(passcode).digest("hex");
}

/**
 * 管理画面の合言葉を確認する。
 * DB（admin_settings）に保存済みならそれと照合し、まだ一度も
 * 管理画面から変更していない場合は .env.local の ADMIN_PASSCODE を初期値として使う。
 */
export async function checkAdminPasscode(passcode: string | null): Promise<boolean> {
  if (!passcode) return false;

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { data } = await supabaseAdmin
      .from("admin_settings")
      .select("passcode_hash")
      .eq("id", true)
      .maybeSingle();

    if (data) {
      return data.passcode_hash === hashPasscode(passcode);
    }
  } catch {
    // Supabase未接続時などはフォールバックへ
  }

  return !!config.adminPasscode && passcode === config.adminPasscode;
}

export async function changeAdminPasscode(newPasscode: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("admin_settings").upsert({
    id: true,
    passcode_hash: hashPasscode(newPasscode),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
