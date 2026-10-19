// マスタCSV（containers.csv / test_items.csv）の1行を、アプリで使う形に変換する。
// 管理画面のCSV取り込み（/api/admin/import）と院内サーバー版（intranet/）の
// 両方がこの変換を使うため、同じCSVがどちらでも同じ意味で読まれる。

export type ContainerRow = {
  container_code?: string;
  vessel?: string;
  material?: string;
  dispense_location?: string;
  dispense_phs?: string;
  inquiry_dept?: string;
  inquiry_phs?: string;
  item_count?: string;
  collection_amount?: string;
  representative_item_code?: string;
  test_summary?: string;
  has_instruction?: string;
  instruction_1?: string;
  instruction_2?: string;
  instruction_3?: string;
  notes?: string;
  image_source_code?: string;
};

export type TestItemRow = {
  test_item_code?: string;
  test_item_name?: string;
  container_code?: string;
};

export function toContainerRecord(row: ContainerRow) {
  const containerCode = row.container_code?.trim();
  if (!containerCode) return null;

  const collectionAmount = row.collection_amount?.trim();

  return {
    container_code: containerCode,
    vessel: row.vessel?.trim() || null,
    material: row.material?.trim() || null,
    dispense_location: row.dispense_location?.trim() || null,
    dispense_phs: row.dispense_phs?.trim() || null,
    inquiry_dept: row.inquiry_dept?.trim() || null,
    inquiry_phs: row.inquiry_phs?.trim() || null,
    item_count: row.item_count ? Number(row.item_count) : null,
    collection_amount:
      collectionAmount === "----" ? "規定なし" : collectionAmount || null,
    representative_item_code: row.representative_item_code?.trim() || null,
    test_summary: row.test_summary?.trim() || null,
    has_instruction: row.has_instruction?.trim() === "1",
    instruction_1: row.instruction_1?.trim() || null,
    instruction_2: row.instruction_2?.trim() || null,
    instruction_3: row.instruction_3?.trim() || null,
    notes: row.notes?.trim() || null,
    image_source_code: row.image_source_code?.trim() || null,
  };
}

export function toTestItemRecord(row: TestItemRow) {
  const testItemCode = row.test_item_code?.trim();
  if (!testItemCode) return null;

  return {
    test_item_code: testItemCode,
    test_item_name: row.test_item_name?.trim() || "",
    container_code: row.container_code?.trim() || null,
  };
}
