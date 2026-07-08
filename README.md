# ACLiSS（臨床検査情報提供システム）

看護師が採血・採取時に「どの容器を使うか」「採取量」「払い出し場所」「注意事項」を
スマートフォンで即座に確認できるシステムです。

現在のフェーズ: **フェーズ2（バックエンドAPI・管理画面）完了**

## 今できること

- Next.js（App Router）+ TypeScript + Tailwind CSS の雛形が動作します。
- 画面上部にACLiSSのヘッダー（ネイビー背景＋ゴールドのアクセント）が表示されます。
- 容器マスタ・検査項目マスタのDBスキーマ設計が完了しました（`supabase/schema.sql`）。
- バーコード（12桁）から容器コード（3桁）を取り出すロジックを実装しました（`src/lib/barcode.ts`）。
- SupabaseプロジェクトのURL・anonキーを `.env.local` に設定済みです。
- 読み取り用API（誰でもアクセス可、閲覧専用）
  - `GET /api/containers`（容器一覧）
  - `GET /api/containers/[code]`（容器コード指定の詳細）
  - `GET /api/test-items`（検査項目一覧）
- 管理画面 `/admin`（合言葉によるアクセス制限つき）
  - 容器マスタCSV・検査項目マスタCSVのアップロード（取り込みのたびに `import_logs` に記録）
  - 容器写真のアップロード（Supabaseストレージへ保存し、`containers.image_url` を自動更新）
  - 容器マスタの簡易一覧表示
- 検索エンジンにインデックスされないよう `robots.txt` で全ページを非公開に設定済み。

## ディレクトリ構成（フェーズ2時点）

```
ACLiSS/
├── src/
│   ├── app/
│   │   ├── layout.tsx    共通レイアウト（ヘッダーなど）
│   │   ├── page.tsx      トップページ
│   │   ├── globals.css   全体のスタイル・ACLiSSの配色定義
│   │   ├── robots.ts     検索エンジン非公開設定
│   │   ├── admin/page.tsx  管理画面（合言葉入力→CSV・写真アップロード・一覧）
│   │   └── api/
│   │       ├── containers/route.ts          GET 容器一覧
│   │       ├── containers/[code]/route.ts   GET 容器詳細
│   │       ├── test-items/route.ts          GET 検査項目一覧
│   │       └── admin/
│   │           ├── import/route.ts          POST CSV取り込み（合言葉必須）
│   │           └── upload-image/route.ts    POST 容器写真アップロード（合言葉必須）
│   └── lib/
│       ├── config.ts         バックエンド（Supabase）の接続先を1箇所にまとめる設定ファイル
│       │                      ※将来、院内イントラに移設する際もこのファイルの中身は変えず、
│       │                        環境変数（.env.local）の値だけ差し替えればよい設計です
│       ├── supabase.ts        Supabaseクライアント（閲覧側・読み取り専用）
│       ├── supabase-admin.ts  Supabaseクライアント（管理画面専用・書き込み権限あり）
│       ├── barcode.ts         バーコード12桁 → 容器コード3桁 変換ロジック
│       └── types.ts           Container / TestItem の型定義
├── supabase/
│   ├── schema.sql        容器マスタ・検査項目マスタ・操作ログのテーブル定義
│   └── README.md         Supabaseプロジェクト作成手順（依頼者向け）
├── docs/
│   ├── security-overview.md    情報セキュリティ部門向け説明メモ
│   └── phase1-master-data.md   マスタのExcel列⇔DBフィールド対応表
├── public/                画像などの静的ファイル
├── .env.local.example    環境変数の雛形（実際の値は .env.local に書き、Gitには含めない）
└── package.json
```

## 開発サーバーの起動方法

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開くと確認できます（ローカルで動作確認する場合。
iPad等で確認する場合はVercel等へのデプロイが必要です）。

## 今の宿題（依頼者側の作業）

1. Supabaseダッシュボードの「Legacy anon, service_role API keys」タブから
   **service_role キー**をコピーし、`.env.local` の `SUPABASE_SERVICE_ROLE_KEY=` に
   貼り付けてください（`anon`キーとは別物です。絶対に公開しないでください）。
2. `/admin` にアクセスし、`.env.local` の `ADMIN_PASSCODE` の値を合言葉として入力すると
   管理画面に入れます。
3. Vercelにデプロイする場合は、Vercel側の環境変数にも同じ内容
   （`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
   `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_PASSCODE`）を設定してください。
4. 実際の「ACLiSSマスタ.xlsx」と容器写真一式を、準備でき次第共有いただければ、
   Excel→CSV変換の手順もご案内します。

## 今後の予定（フェーズ3以降）

1. 一覧・検索・バーコードスキャンの画面を作る（看護師が実際に使う画面）
2. PWA化（ホーム画面への追加、オフライン対応）
3. QRコードでの配布

各フェーズが終わるごとに、動作確認と簡単な説明を挟みながら進めます。
