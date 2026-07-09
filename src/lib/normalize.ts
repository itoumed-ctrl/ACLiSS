/**
 * 検索用の文字列正規化。全角英数字・記号を半角に変換し、小文字化する。
 * マスタデータには「ＡＳＴ」のように全角で入力されている項目名があるため、
 * 検索時に半角/全角の違いを気にしなくてよいようにする。
 */
export function normalizeForSearch(value: string): string {
  return value
    .replace(/[！-～]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    )
    .replace(/　/g, " ")
    .toLowerCase();
}
