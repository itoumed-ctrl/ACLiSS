/**
 * バックエンド接続先の一元設定。
 *
 * 当面: Supabase（外部クラウド、無料枠）を指す。
 * 将来: 院内イントラサーバーへ移設する際は、このファイルは変更せず、
 *       環境変数（.env.local や本番のホスティング設定）の値だけを
 *       差し替えれば切り替えられるようにする。
 */
export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};
