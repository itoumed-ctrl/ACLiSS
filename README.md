# ACLiSS（臨床検査情報提供システム）

看護師が採血・採取時に「どの容器を使うか」「採取量」「払い出し場所」「注意事項」を
スマートフォンで即座に確認できるシステムです。

現在のフェーズ: **フェーズ3（看護師が使う画面）完了**

## 今できること

- Next.js（App Router）+ TypeScript + Tailwind CSS の雛形が動作します。
- 画面上部にACLiSSのヘッダー（ネイビー背景＋ゴールドのアクセント）が表示されます。
- 容器マスタ・検査項目マスタのDBスキーマ設計が完了しました（`supabase/schema.sql`）。
- バーコード（12桁）から容器コード（3桁）を取り出すロジックを実装しました（`src/lib/barcode.ts`）。
- SupabaseプロジェクトのURL・anonキー・service_roleキーを設定済みです。
- 読み取り用API（誰でもアクセス可、閲覧専用）
  - `GET /api/containers`（容器一覧）
  - `GET /api/containers/[code]`（容器コード指定の詳細）
  - `GET /api/test-items`（検査項目一覧）
- 管理画面 `/admin`（合言葉によるアクセス制限つき）
  - 容器マスタCSV・検査項目マスタCSVのアップロード（取り込みのたびに `import_logs` に記録）
  - 容器写真のアップロード（Supabaseストレージへ保存し、`containers.image_url` を自動更新）
  - 容器マスタの簡易一覧表示
- 検索エンジンにインデックスされないよう `robots.txt` で全ページを非公開に設定済み。
- **看護師が使う画面（3つの導線）**
  - `/scan`: スマホカメラでバーコードを読み取り、容器詳細へ自動遷移
    （カメラが使えない場合は12桁を直接入力する欄も用意）
  - `/containers`: 容器一覧から検索して選ぶ
  - `/search`: 検査項目名で検索して、対応する容器の詳細へ遷移
  - `/containers/[code]`: 3つの導線から共通で使う詳細画面
    （容器写真・採取量・払い出し場所・注意事項・採取指示・問い合わせ先を大きな文字で表示）
- **サイト全体にBasic認証**を追加しました（`src/proxy.ts`）。ユーザー名は固定で
  `acliss`、パスワードは合言葉（`VIEWER_PASSCODE`）です。管理画面にはさらに別の
  合言葉（`ADMIN_PASSCODE`）が必要な二重構成です。

## ディレクトリ構成（フェーズ3時点）

```
ACLiSS/
├── src/
│   ├── app/
│   │   ├── layout.tsx      共通レイアウト（ヘッダーなど）
│   │   ├── page.tsx        トップページ（3つの導線ボタン）
│   │   ├── globals.css     全体のスタイル・ACLiSSの配色定義
│   │   ├── robots.ts       検索エンジン非公開設定
│   ├── proxy.ts            サイト全体へのBasic認証（VIEWER_PASSCODE）
│   │   ├── scan/page.tsx           バーコードスキャン画面
│   │   ├── containers/page.tsx     容器一覧・検索画面
│   │   ├── containers/[code]/page.tsx  容器詳細画面
│   │   ├── search/page.tsx         検査項目検索画面
│   │   ├── admin/page.tsx  管理画面（合言葉入力→CSV・写真アップロード・一覧）
│   │   └── api/
│   │       ├── containers/route.ts          GET 容器一覧
│   │       ├── containers/[code]/route.ts   GET 容器詳細
│   │       ├── test-items/route.ts          GET 検査項目一覧
│   │       └── admin/
│   │           ├── import/route.ts          POST CSV取り込み（合言葉必須）
│   │           └── upload-image/route.ts    POST 容器写真アップロード（合言葉必須）
│   ├── components/
│   │   ├── ContainerDetail.tsx   容器詳細の共通表示コンポーネント
│   │   └── UpdatedAtNotice.tsx   「最終更新: ◯月◯日」表示
│   └── lib/
│       ├── config.ts         バックエンド（Supabase）の接続先を1箇所にまとめる設定ファイル
│       │                      ※将来、院内イントラに移設する際もこのファイルの中身は変えず、
│       │                        環境変数（.env.local）の値だけ差し替えればよい設計です
│       ├── supabase.ts        Supabaseクライアント（閲覧側・読み取り専用）
│       ├── supabase-admin.ts  Supabaseクライアント（管理画面専用・書き込み権限あり）
│       ├── useMasterData.ts   容器・検査項目一覧を取得し、localStorageにもキャッシュするフック
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
iPad等で確認する場合はVercel等へのデプロイが必要です。カメラ機能はHTTPS環境でのみ
動作するため、バーコードスキャンのテストはVercel等の本番URLで行ってください）。

## 今の宿題（依頼者側の作業）

1. Vercelの環境変数に `VIEWER_PASSCODE` を追加してください（値は `.env.local` と同じ）。
   これを忘れるとサイト全体が500エラーになります（安全側の挙動です）。
2. デプロイ後、サイトを開くとID・パスワードを聞かれます。ユーザー名は `acliss`、
   パスワードは `VIEWER_PASSCODE` の値を入力してください。
3. 実際の「ACLiSSマスタ.xlsx」と容器写真一式を、準備でき次第共有いただければ、
   Excel→CSV変換の手順もご案内します（まだで大丈夫です）。
4. マスタ投入後、実際のスマホ・iPadで①バーコードスキャン、②容器一覧、③検査項目検索の
   3つの導線を試してください。

## 今後の予定（フェーズ4以降）

1. PWA化（ホーム画面への追加、オフライン対応の強化）
2. QRコードでの配布

各フェーズが終わるごとに、動作確認と簡単な説明を挟みながら進めます。
