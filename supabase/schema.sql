-- ACLiSS マスタデータ スキーマ（フェーズ1）
-- 実行方法: Supabaseダッシュボード → SQL Editor に貼り付けて実行してください。
-- 何度実行しても壊れないよう IF NOT EXISTS を使っています。

-- ============================================================
-- 容器マスタ（Excel「材料シート」に対応、約330件）
-- ============================================================
create table if not exists containers (
  container_code text primary key,           -- 材料コード（3桁, 例: '073'）
  vessel text,                               -- VESSEL（容器の種類・色）
  material text,                             -- MATERIAL（検体材料・用途）
  dispense_location text,                    -- 容器払い出し場所
  dispense_phs text,                         -- 払い出し場所のPHS/内線番号
  inquiry_dept text,                         -- 問い合わせ先部署
  inquiry_phs text,                          -- 問い合わせ先のPHS/内線番号
  item_count integer,                        -- 該当項目数（参考値）
  collection_amount text,                    -- 規定採取量（"規定なし"を含む）
  representative_item_code text,             -- 代表項目コード
  test_summary text,                         -- 検査項目の概要テキスト
  has_instruction boolean not null default false, -- 個別の採取指示があるか
  instruction_1 text,
  instruction_2 text,
  instruction_3 text,
  notes text,                                -- 一般的な注意事項
  image_path_raw text,                       -- 元データの院内共有フォルダパス（参考用、表示には使わない）
  image_source_code text,                    -- 実際に表示する画像を持つ容器コード（写真の使い回し先。
                                              -- 自分自身のコードと同じ場合は自分の写真を使う）
  image_url text,                            -- Supabaseストレージ上の容器写真URL（移行後に設定）
  updated_at timestamptz not null default now()
);

-- 既存テーブルに対しては create table if not exists が効かないため、
-- 列追加は別途ここで行う（何度実行しても壊れない）。
alter table containers add column if not exists image_source_code text;

comment on table containers is '容器マスタ。患者個人情報・要配慮個人情報は一切含めない。';
comment on column containers.collection_amount is 'Excel上で "----" だったものは「規定なし」という文字列として保存する';
comment on column containers.image_source_code is '写真が使い回されている場合、実際の画像ファイルを持つ容器コード';

-- ============================================================
-- 検査項目マスタ（Excel「オーダ可能項目シート」に対応、約1,740件）
-- ============================================================
create table if not exists test_items (
  test_item_code text primary key,           -- 項目コード（末尾の空白はトリムして保存）
  test_item_name text not null,              -- 検査項目名
  container_code text references containers(container_code),
  updated_at timestamptz not null default now()
);

create index if not exists test_items_container_code_idx
  on test_items (container_code);

comment on table test_items is '検査項目マスタ。1つの容器コードに複数の検査項目が紐づく（多対1）。';

-- ============================================================
-- マスタ更新の操作ログ（監査用）
-- ============================================================
create table if not exists import_logs (
  id bigint generated always as identity primary key,
  imported_at timestamptz not null default now(),
  imported_by text,                          -- 実行した管理者（管理画面ログインのメール等）
  source_file_name text,                     -- アップロードされたCSVのファイル名
  containers_count integer,                  -- 取り込んだ容器マスタ件数
  test_items_count integer,                  -- 取り込んだ検査項目マスタ件数
  note text
);

comment on table import_logs is 'CSVインポート操作の監査ログ（いつ・誰が・何件更新したか）。';

-- ============================================================
-- 管理画面のパスワード（合言葉）。管理画面から変更できるようにするため、
-- .env.local の環境変数ではなくDBに保存する。パスワードそのものではなく
-- ハッシュ値のみ保存し、anonキーからは一切読めない設計にする。
-- ============================================================
create table if not exists admin_settings (
  id boolean primary key default true,
  passcode_hash text not null,
  updated_at timestamptz not null default now(),
  constraint admin_settings_single_row check (id)
);

comment on table admin_settings is '管理画面の合言葉（ハッシュ値のみ）。常に1行だけ存在する。';

-- ============================================================
-- 閲覧側画面のアクセスログ（いつ・どのページに・どこから）
-- 閲覧側に認証をかけていない運用上のトレードオフを補うため、
-- 不審なアクセスがないか管理画面から確認できるようにする。
-- ============================================================
create table if not exists access_logs (
  id bigint generated always as identity primary key,
  accessed_at timestamptz not null default now(),
  path text not null,                        -- アクセスされたページ（例: /containers/121）
  ip_address text,                           -- アクセス元IPアドレス
  user_agent text                            -- ブラウザ情報
);

create index if not exists access_logs_accessed_at_idx
  on access_logs (accessed_at desc);

comment on table access_logs is '閲覧側画面のアクセスログ。IPアドレスを含むため管理画面以外には公開しない。';

-- ============================================================
-- Row Level Security（閲覧はどこからでも可、書き込みはサーバー側のみ）
-- ============================================================
alter table containers enable row level security;
alter table test_items enable row level security;
alter table import_logs enable row level security;
alter table admin_settings enable row level security;
alter table access_logs enable row level security;

-- フロント（anonキー）からは読み取りのみ許可する。
-- 書き込みは管理画面のAPI（service_roleキーを使うサーバー側処理、フェーズ2で実装）のみが行う。
drop policy if exists "containers_select_anon" on containers;
create policy "containers_select_anon" on containers
  for select using (true);

drop policy if exists "test_items_select_anon" on test_items;
create policy "test_items_select_anon" on test_items
  for select using (true);

-- import_logs・admin_settings・access_logs は閲覧側には公開しない
-- （管理画面のサーバー側処理のみが参照する想定のため、anon向けpolicyは作らない）
