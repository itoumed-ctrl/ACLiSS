# ACLiSS 院内サーバー版

院内のWebサーバーにファイルを置くだけで動く版です。インターネット上のサービス
（Vercel・Supabase）を使わず、マスタは院内サーバー上のCSVとPNGで管理します。

## Vercel版との違い

| 機能 | Vercel版 | 院内サーバー版 |
|---|---|---|
| バーコードスキャン・手入力 | ○ | ○（カメラはHTTPSで開いた場合のみ） |
| 容器一覧・容器詳細・検査項目検索 | ○ | ○ |
| 最低採血量の計算 | ○ | なし |
| マスタの更新 | 管理画面から | CSV・PNGファイルを上書き |
| アクセスログ | 管理画面で確認 | Webサーバー自体のアクセスログで確認 |
| メンテナンス切替・合言葉 | ○ | なし（管理画面そのものがありません） |
| 外部への通信 | Vercel・Supabase | なし |

## 院内サーバーに置くフォルダ

`npm run build:intranet` を実行すると `intranet-dist/` ができます。この中身を丸ごと、
院内のWebサーバーの好きな場所にコピーしてください（例: `https://院内サーバー/acliss/`）。

```
acliss/                  ← フォルダ名・置き場所は自由
├── index.html           ← アプリ本体（以下3つも含めて上書きで更新）
├── app.js
├── app.css
├── manifest.webmanifest
├── icons/
├── master/              ← マスタCSV（院内で管理）
│   ├── containers.csv
│   └── test_items.csv
└── images/              ← 容器写真（院内で管理）
    ├── 073.png
    └── …
```

## Webサーバーの条件

- 静的なファイルを配信できるWebサーバーなら何でも動きます（IIS・Apache・nginx など）。
  サーバー側にプログラムやデータベースは不要です。
- **HTTPS（`https://`）での配信を推奨します。** iPhone・Androidのブラウザは、HTTPSで開いた
  ページでしかカメラを使わせません。`http://` で開いた場合、バーコードは読めませんが、
  ラベルの数字の手入力と、それ以外の機能はすべて使えます。
- IISでは、未登録の拡張子のファイルを配信しない設定になっていることがあります。
  `master/containers.csv` や `manifest.webmanifest` が開けない場合は、MIMEの種類に
  `.csv`（`text/csv`）と `.webmanifest`（`application/manifest+json`）を追加してください。

## マスタの更新方法

### CSV（`master/` フォルダ）

- `containers.csv`（容器マスタ）と `test_items.csv`（検査項目マスタ）を上書きします。
  次にACLiSSを開いた時から、新しい内容が表示されます。
- 列名（1行目）は、Vercel版の管理画面「マスタ管理」の「現在のマスタをCSVでダウンロード」で
  取れるCSVと同じです。最初の移行は、そのダウンロードしたCSVをそのまま置けば完了します。
  ExcelのマスタからCSVを作る場合は `scripts/convert-master-xlsx.py` で変換できます。
- Excelで編集した場合、「CSV（コンマ区切り）」「CSV UTF-8」のどちらで保存しても読めます。
- 列名が違うなど読み込めないCSVを置いた場合、端末に前回の内容が残っていればそれを表示し、
  「前回のデータを表示中」と出ます。

### 写真（`images/` フォルダ）

- 写真はPNGで、ファイル名を「容器コード.png」にします（例: `073.png`）。
- 表示されるのは、`containers.csv` の `image_source_code` 列に書かれた容器コードの写真です。
  同じ写真を使い回している容器は、写真ファイル1つで済みます。
- 写真がない容器は `image_source_code` を空欄にします。写真ファイルが見つからない場合も、
  写真の欄が出ないだけで、その他の情報は通常どおり表示されます。

## アプリ本体の更新

新しい `intranet-dist/` の中身で上書きします。このとき、院内で管理している `master/` と
`images/` は上書き・削除しないでください（ビルド結果の `master/`・`images/` には説明の
テキストファイルしか入っていません）。

## 作り直し方（開発者向け）

```bash
npm install
npm run build:intranet
```

本体（Next.js版）の画面部品（最低採血量の計算を除く）をそのまま使い、Next.js専用の部品（`next/link`・
`next/navigation`）とデータの取得元（`@/lib/useMasterData`）だけを `intranet/src/` の
ものに差し替えてビルドしています（`intranet/build.mjs`）。画面の切り替えはURLの `#` 以降で
行うため、Webサーバー側にURL書き換えの設定は要りません。

## 端末に残るもの

電波が弱い場所でも使えるよう、読み込んだマスタの控えを端末のブラウザ内に保存します
（Vercel版と同じく、個人情報は含みません）。
