@AGENTS.md

## 院内サーバー版（intranet/）を変更した時に毎回やること

院内サーバー版に変更を入れたら、次の3つを必ずすべて更新し、ユーザーに出力する（ユーザーの指示）。

1. **zip**: `npm run build:intranet -- --preview` のあと、次の構成の `acliss-intranet.zip` を作って送る。
   - `acliss/` … `intranet-dist/` の中身。`acliss/master/` にはユーザーのひな型 `ACLiSSマスタ.xlsx` の
     「材料」→ `containers.csv`、「オーダ可能項目」→ `test_items.csv` を、UTF-8（BOM付き）のCSVにして入れる。
     このxlsxは院内のデータなのでリポジトリには入れていない。手元にない時はユーザーに渡してもらう。
   - `ログ集計ツール.html` … `intranet/log-summary.html` のコピー
   - `電話帳ひな型.csv` … 1行目 `大分類,小分類,内線番号,説明` だけのCSV（UTF-8・BOM付き）
2. **プレビュー**: 同じURLのまま公開し直す。
   - アプリ: `intranet-preview/acliss-preview.html` → https://claude.ai/artifact/3Zq6YrB63hvNcmFxnkRsgM
   - ログ管理ダッシュボード: `intranet-preview/log-dashboard-preview.html` → https://claude.ai/artifact/4P6aHi8wcdkdAWrdHFEyif
3. **提案書**: 情報管理G宛ての提案シート（Claude Docs）の、変更に関係する箇所を書き直す。
   https://claude.ai/code/artifact/ff54bb46-f048-4e54-9667-54d4cf988374

Vercel版（`src/`）の画面やCSV形式は、ユーザーの指示がない限り変えない。
