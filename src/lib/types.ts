export interface Container {
  container_code: string;
  vessel: string | null;
  material: string | null;
  dispense_location: string | null;
  dispense_phs: string | null;
  inquiry_dept: string | null;
  inquiry_phs: string | null;
  item_count: number | null;
  collection_amount: string | null;
  representative_item_code: string | null;
  test_summary: string | null;
  has_instruction: boolean;
  instruction_1: string | null;
  instruction_2: string | null;
  instruction_3: string | null;
  notes: string | null;
  image_path_raw: string | null;
  image_source_code: string | null;
  image_url: string | null;
  updated_at: string;
}

export interface TestItem {
  test_item_code: string;
  test_item_name: string;
  container_code: string | null;
  updated_at: string;
}

export interface AccessLog {
  id: number;
  accessed_at: string;
  path: string;
  ip_address: string | null;
  user_agent: string | null;
  event: string | null;
}
