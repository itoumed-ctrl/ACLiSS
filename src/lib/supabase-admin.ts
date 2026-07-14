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

export interface MaintenanceStatus {
  enabled: boolean;
  message: string | null;
}

/**
 * 現在のメンテナンス状態を取得する。
 * Supabase未接続時や未設定時は「メンテナンスではない」として扱い、
 * 閲覧側の画面表示を止めないようにする。
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { data } = await supabaseAdmin
      .from("admin_settings")
      .select("maintenance_mode, maintenance_message")
      .eq("id", true)
      .maybeSingle();

    return {
      enabled: Boolean(data?.maintenance_mode),
      message: data?.maintenance_message ?? null,
    };
  } catch {
    return { enabled: false, message: null };
  }
}

/**
 * メンテナンス状態を変更する（管理画面から呼ぶ）。
 * admin_settings の行がまだ無い場合（合言葉を一度も変更しておらず環境変数で
 * 運用しているケース）でも作成できるよう、照合済みの現在の合言葉ハッシュも
 * 併せて upsert する。合言葉は正しいものなので上書きしても内容は変わらない。
 */
export async function setMaintenanceStatus(
  enabled: boolean,
  message: string | null,
  currentPasscode: string,
): Promise<void> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("admin_settings").upsert({
    id: true,
    passcode_hash: hashPasscode(currentPasscode),
    maintenance_mode: enabled,
    maintenance_message: message,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * 閲覧側画面のアクセスを記録する。ログ記録自体の失敗は画面表示に影響させない。
 */
export async function logAccess(entry: {
  path: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceId: string | null;
  event?: string;
}): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    await supabaseAdmin.from("access_logs").insert({
      path: entry.path,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      device_id: entry.deviceId,
      event: entry.event ?? null,
    });
  } catch {
    // Supabase未接続時などは記録をスキップする
  }
}
