import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

let client: SupabaseClient | null = null;

/**
 * 閲覧側（フロント）用のSupabaseクライアント。anonキーのみ使用し、読み取り専用。
 * Supabase側のRow Level Security（supabase/schema.sql）でselectのみ許可している。
 *
 * 遅延生成にしているのは、.env.local が未設定の段階（フェーズ0〜1初期）でも
 * このファイルをimportするだけでビルドが壊れないようにするため。
 */
export function getSupabaseClient(): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      "Supabaseの接続情報が未設定です。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください（supabase/README.md 参照）。",
    );
  }
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
  return client;
}
