/**
 * 検索用の文字列正規化。
 * - 全角英数字・半角カタカナなどを標準形に統一（NFKC正規化）
 *   例: 「ＡＳＴ」→「AST」、「ﾑﾗｻｷ」→「ムラサキ」
 * - カタカナをひらがなに統一し、ひらがな・カタカナの違いを気にせず検索できるようにする
 * - 小文字化してアルファベットの大文字・小文字の違いも吸収する
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/　/g, " ")
    .toLowerCase();
}
