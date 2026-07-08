# ACLiSS（臨床検査情報提供システム）

看護師が採血・採取時に「どの容器を使うか」「採取量」「払い出し場所」「注意事項」を
スマートフォンで即座に確認できるシステムです。

現在のフェーズ: **フェーズ2（バックエンドAPI・進行中）**

## 今できること

- Next.js（App Router）+ TypeScript + Tailwind CSS の雛形が動作します。
- 画面上部にACLiSSのヘッダー（ネイビー背景＋ゴールドのアクセント）が表示されます。
- 容器マスタ・検査項目マスタのDBスキーマ設計が完了しました（`supabase/schema.sql`）。
- バーコード（12桁）から容器コード（3桁）を取り出すロジックを実装しました（`src/lib/barcode.ts`）。
- SupabaseプロジェクトのURL・anonキーを `.env.local` に設定済みです。
- 読み取り用APIを実装しました（データが入るとブラウザから確認できます）
  - `GET /api/containers`（容器一覧）
  - `GET /api/containers/[code]`（容器コード指定の詳細）
  - `GET /api/test-items`（検査項目一覧）

## ディレクトリ構成（フェーズ2時点）

```
ACLiSS/
├── src/
│   ├── app/
│   │   ├── layout.tsx    共通レイアウト（ヘッダーなど）
│   │   ├── page.tsx      トップページ
│   │   ├── globals.css   全体のスタイル・ACLiSSの配色定義
│   │   └── api/
│   │       ├── containers/route.ts          GET 容器一覧
│   │       ├── containers/[code]/route.ts   GET 容器詳細
│   │       └── test-items/route.ts          GET 検査項目一覧
│   └── lib/
│       ├── config.ts     バックエンド（Supabase）の接続先を1箇所にまとめる設定ファイル
│       │                  ※将来、院内イントラに移設する際もこのファイルの中身は変えず、
│       │                    環境変数（.env.local）の値だけ差し替えればよい設計です
│       ├── supabase.ts   Supabaseクライアント（読み取り専用）
│       ├── barcode.ts    バーコード12桁 → 容器コード3桁 変換ロジック
│       └── types.ts      Container / TestItem の型定義
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

実際の「ACLiSSマスタ.xlsx」と容器写真一式を、準備でき次第共有いただければ、
取り込みスクリプトを用意します。

## 今後の予定（フェーズ2の残り〜）

1. 管理画面（CSVアップロード、写真アップロード、簡易認証）を作る
2. 一覧・検索・バーコードスキャンの画面を作る
3. PWA化（ホーム画面への追加、オフライン対応）
4. QRコードでの配布

各フェーズが終わるごとに、動作確認と簡単な説明を挟みながら進めます。
