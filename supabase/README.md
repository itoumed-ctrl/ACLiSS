# Supabaseプロジェクトのセットアップ手順

ここはコードではなく「依頼者（あなた）にしかできない作業」です。Supabaseのアカウント作成・
プロジェクト作成は、私（Claude Code）が代わりに行うことができないため、以下の手順で
進めてください。

## 1. Supabaseプロジェクトを作成する

1. https://supabase.com にアクセスし、「Start your project」→ GitHubアカウントでログイン（無料）
2. 「New Project」を作成
   - Project name: `acliss` など分かりやすい名前
   - Database Password: 自動生成でよい（後で使わないので保管は必須ではないが念のため控えておく）
   - Region: `Northeast Asia (Tokyo)` を選択（一番近いため）
3. 数分待つとプロジェクトが使えるようになります

## 2. テーブルを作成する（このリポジトリのSQLを実行）

1. Supabaseダッシュボードの左メニューから「SQL Editor」を開く
2. 「New query」を作成し、このフォルダの `schema.sql` の中身を全部貼り付けて実行（Run）
3. 左メニューの「Table Editor」を開き、`containers` / `test_items` / `import_logs` の
   3つのテーブルができていることを確認

## 3. 接続情報を控える

1. 左メニューの「Project Settings」→「API」を開く
2. 以下の2つをコピーする
   - `Project URL`（例: `https://xxxxxxxx.supabase.co`）
   - `anon public` キー（閲覧用の公開キー）
3. リポジトリ直下に `.env.local` というファイルを作り（`.env.local.example` をコピーして
   リネームする）、以下のように値を入れる

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=（コピーしたanon public キー）
```

`.env.local` はGit管理対象外（`.gitignore`に設定済み）なので、このファイルの中身が
GitHubに公開されることはありません。

## 4. 画像用のストレージバケットを作る（容器写真、フェーズ1後半で使用）

1. 左メニューの「Storage」→「New bucket」
2. バケット名: `container-images`
3. 「Public bucket」をオンにする（容器写真自体は個人情報ではないため、閲覧専用で公開してよい）

## この後の流れ

- 上記1〜4が終わったら教えてください。実際の `ACLiSSマスタ.xlsx` を共有いただければ、
  CSVへの変換・取り込みスクリプトと、容器写真の一括アップロード手順を用意します。
- `service_role`キー（管理画面のマスタ更新で使う、書き込み権限を持つ特別なキー）は
  フェーズ2で管理画面を作る際に案内します。`anon`キーとは違い、絶対に公開・共有しないでください。
