import { useEffect, useState } from "react";
import Papa from "papaparse";
import type { Container, TestItem } from "@/lib/types";
import {
  type ContainerRow,
  type TestItemRow,
  toContainerRecord,
  toTestItemRecord,
} from "@/lib/masterCsv";

// 院内サーバー版のマスタ読み込み。index.html と同じ場所にある
// master/containers.csv・master/test_items.csv を読み、容器写真は
// images/<画像の容器コード>.png を表示する。CSVやPNGを差し替えるだけで更新できる。

const CONTAINERS_CSV = "master/containers.csv";
const TEST_ITEMS_CSV = "master/test_items.csv";

const CACHE_KEY = "acliss-intranet-master";

type MasterData = {
  containers: Container[];
  testItems: TestItem[];
  updatedAt: string;
};

function readCache(): MasterData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as MasterData) : null;
  } catch {
    return null;
  }
}

function writeCache(data: MasterData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // 保存できない端末設定でも表示自体は続ける
  }
}

// Excelで「CSV（コンマ区切り）」保存するとShift_JISになり、「CSV UTF-8」だとUTF-8になる。
// どちらで保存されても読めるよう、UTF-8として読めなければShift_JISとして読み直す。
function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("shift_jis").decode(buffer);
  }
}

// 開発中の確認用プレビュー（npm run build:intranet -- --preview）だけが使う。
// サーバーに置かず1ファイルで動かすため、CSVと写真をページ内に埋め込んで渡す。
type PreviewData = { files: Record<string, string>; images: Record<string, string> };
const preview = (globalThis as { __ACLISS_PREVIEW__?: PreviewData }).__ACLISS_PREVIEW__;

async function readCsvFile(path: string) {
  if (preview) {
    const text = preview.files[path];
    if (text === undefined) throw new Error(`${path} がプレビューに含まれていません。`);
    return { text, lastModified: null };
  }
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(
      `${path} を読み込めませんでした（${res.status}）。院内サーバーの master フォルダにファイルがあるか確認してください。`,
    );
  }
  return {
    text: decodeCsv(await res.arrayBuffer()),
    lastModified: res.headers.get("last-modified"),
  };
}

async function fetchCsv<T>(path: string, requiredColumns: string[]) {
  const { text, lastModified } = await readCsvFile(path);
  const parsed = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const columns = parsed.meta.fields ?? [];
  const missing = requiredColumns.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `${path} の1行目（列名）に ${missing.join("、")} がありません。管理画面からダウンロードしたCSVと同じ列名にしてください。`,
    );
  }
  return { rows: parsed.data, lastModified };
}

function imagePath(imageSourceCode: string | null) {
  if (!imageSourceCode) return null;
  if (preview) return preview.images[imageSourceCode] ?? null;
  return `images/${encodeURIComponent(imageSourceCode)}.png`;
}

async function loadMaster(): Promise<MasterData> {
  const [containersCsv, testItemsCsv] = await Promise.all([
    fetchCsv<ContainerRow>(CONTAINERS_CSV, ["container_code"]),
    fetchCsv<TestItemRow>(TEST_ITEMS_CSV, ["test_item_code", "test_item_name"]),
  ]);

  // 画面の「最終更新」には、読み込んだ時刻ではなくCSVファイル自体の更新日時を出す。
  const modifiedTimes = [containersCsv.lastModified, testItemsCsv.lastModified]
    .map((v) => (v ? Date.parse(v) : NaN))
    .filter((t) => !Number.isNaN(t));
  const updatedAt = new Date(
    modifiedTimes.length > 0 ? Math.max(...modifiedTimes) : Date.now(),
  ).toISOString();

  const containers: Container[] = containersCsv.rows
    .map(toContainerRecord)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ ...r, image_url: imagePath(r.image_source_code), updated_at: updatedAt }))
    .sort((a, b) => a.container_code.localeCompare(b.container_code, "ja", { numeric: true }));

  const testItems: TestItem[] = testItemsCsv.rows
    .map(toTestItemRecord)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ ...r, updated_at: updatedAt }));

  return { containers, testItems, updatedAt };
}

// 画面を移動するたびにCSVを読み直さないよう、ページを開いている間は1回だけ読む。
let loadPromise: Promise<MasterData> | null = null;

export function useMasterData() {
  const [data, setData] = useState<MasterData | null>(readCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPromise ??= loadMaster();
    loadPromise
      .then((fresh) => {
        if (cancelled) return;
        setData(fresh);
        setIsOffline(false);
        writeCache(fresh);
      })
      .catch((e: unknown) => {
        loadPromise = null;
        if (cancelled) return;
        setIsOffline(true);
        setError(e instanceof Error ? e.message : "マスタを読み込めませんでした");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    containers: data?.containers ?? [],
    testItems: data?.testItems ?? [],
    updatedAt: data?.updatedAt ?? null,
    loading,
    error,
    isOffline,
  };
}
