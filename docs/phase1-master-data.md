# フェーズ1: マスタデータ設計

既存Excel「ACLiSSマスタ.xlsx」の2シートを、Supabase上の2つのテーブルにそのまま
対応させます（実際のSQLは `supabase/schema.sql`）。

## 容器マスタ（containers）← Excel「材料シート」（約330件）

| Excel列名 | DBフィールド名 | 内容 |
|---|---|---|
| 材料コード | container_code | 容器コード（3桁、主キー） |
| VESSEL | vessel | 容器の種類・色 |
| MATERIAL | material | 検体材料・用途 |
| 容器払い出し | dispense_location | 払い出し場所 |
| 内線番号① | dispense_phs | 払い出し場所のPHS/内線番号 |
| 問い合わせ先 | inquiry_dept | 検査問い合わせ先部署 |
| 内線番号② | inquiry_phs | 問い合わせ先のPHS/内線番号 |
| 該当項目数 | item_count | 参考値 |
| 規定採取量 | collection_amount | "----" は「規定なし」として保存 |
| 代表項目コード | representative_item_code | 代表的な検査項目コード |
| 検査項目 | test_summary | 検査項目の概要テキスト |
| 指示有無 | has_instruction | 個別の採取指示があるか（0/1→true/false） |
| 指示①〜③ | instruction_1〜3 | 個別の採取指示（最大3行） |
| 注意事項 | notes | 一般的な注意事項 |
| 画像パス | image_path_raw | 元の院内共有フォルダパス（参考用。表示には使わない） |
| （新規） | image_url | Supabaseストレージ上の写真URL（画像移行後に設定） |

## 検査項目マスタ（test_items）← Excel「オーダ可能項目シート」（約1,740件）

| Excel列名 | DBフィールド名 | 内容 |
|---|---|---|
| 項目コード | test_item_code | 主キー。末尾の空白はトリムして保存 |
| 名称 | test_item_name | 検査項目名 |
| 材料コード | container_code | containersへの外部キー（多対1） |

## バーコード解析ルール（重要な訂正を反映済み）

検査バーコードは12桁。下4桁のうち末尾1桁はチェックデジットで、その手前3桁が
容器コードと一致します。

```
バーコード: 000000001210
下4桁     :         1210
容器コード:         121   （末尾の "0" はチェックデジットなので除外）
```

この処理は `src/lib/barcode.ts` の `extractContainerCodeFromBarcode()` に実装済みです。
チェックデジット自体が正しいかどうかの検証（計算式）はまだ行っていません
（アルゴリズムが不明なため、当面は「取り除くだけ」）。

## 容器写真の移行（未着手・実データ待ち）

Excelの「画像パス」は院内共有フォルダを指しており、Supabaseからは直接参照できません。
実際の画像ファイル一式と `ACLiSSマスタ.xlsx` をお預かりでき次第、

1. 画像を一括でSupabaseストレージ（`container-images`バケット）にアップロードするスクリプト
2. Excelを取り込んでcontainers/test_itemsに反映するスクリプト

を用意します。

## 今回やっていないこと（次のフェーズ以降）

- 実データの取り込み（Excelファイルの共有待ち）
- `/api/containers` などのAPIエンドポイント（フェーズ2）
- 管理画面（CSVアップロード、写真アップロード）（フェーズ2）
