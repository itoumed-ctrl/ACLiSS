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

export function checkAdminPasscode(passcode: string | null): boolean {
  return !!config.adminPasscode && passcode === config.adminPasscode;
}
