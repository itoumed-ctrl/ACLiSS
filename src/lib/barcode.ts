/**
 * 検査バーコード（12桁）から容器コード（3桁）を取り出す。
 *
 * ルール: 下4桁のうち、末尾の1桁はチェックデジット。
 * 残りの3桁が容器マスタの container_code と一致する。
 * 例: "000000001210" → 下4桁 "1210" → 末尾のチェックデジットを除いた "121"
 *
 * チェックデジット自体の検証（計算式）は行わない。単純に取り除くだけ。
 */
export function extractContainerCodeFromBarcode(barcode: string): string | null {
  const digits = barcode.trim();
  if (!/^\d{12}$/.test(digits)) {
    return null;
  }
  const last4 = digits.slice(8, 12);
  return last4.slice(0, 3);
}
