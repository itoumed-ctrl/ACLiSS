"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMasterData } from "@/lib/useMasterData";
import { UpdatedAtNotice } from "@/components/UpdatedAtNotice";
import { normalizeForSearch } from "@/lib/normalize";
import { containerLabel } from "@/lib/containerLabel";
import type { Container, TestItem } from "@/lib/types";
import { BackNav } from "@/components/BackNav";

export default function TestItemSearchPage() {
  const { containers, testItems, updatedAt, loading, error, isOffline } = useMasterData();
  const [query, setQuery] = useState("");

  const containersByCode = useMemo(() => {
    const map = new Map(containers.map((c) => [c.container_code, c]));
    return map;
  }, [containers]);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return [];
    return testItems
      .filter((t) => normalizeForSearch(t.test_item_name).includes(q))
      .slice(0, 50);
  }, [testItems, query]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BackNav />
      <h1 className="mb-4 text-2xl font-bold text-navy">検査項目から探す</h1>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="検査項目名を入力（例: グルコース）"
        className="mb-4 w-full rounded border border-navy/30 px-3 py-3 text-lg"
        autoFocus
      />

      <UpdatedAtNotice updatedAt={updatedAt} isOffline={isOffline} />

      {loading && testItems.length === 0 && <p>読み込み中...</p>}
      {error && testItems.length === 0 && (
        <p className="text-red-600">エラー: {error}</p>
      )}

      {query.trim() === "" && (
        <p className="text-foreground/60">検査項目名の一部を入力してください</p>
      )}

      <ul className="divide-y divide-navy/10">
        {filtered.map((t) => (
          <TestItemRow
            key={t.test_item_code}
            testItem={t}
            container={t.container_code ? containersByCode.get(t.container_code) : undefined}
          />
        ))}
      </ul>

      {query.trim() !== "" && !loading && filtered.length === 0 && (
        <p className="py-6 text-center text-foreground/60">該当する検査項目が見つかりません</p>
      )}
    </div>
  );
}

function TestItemRow({
  testItem,
  container,
}: {
  testItem: TestItem;
  container: Container | undefined;
}) {
  if (!testItem.container_code) {
    return (
      <li>
        <div className="flex flex-col gap-1 py-3 text-foreground/50">
          <span className="text-lg">{testItem.test_item_name}</span>
          <span className="text-sm">対応する容器コードが未設定です</span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/containers/${testItem.container_code}`}
        className="flex flex-col gap-1 py-3 active:bg-navy/5"
      >
        <span className="text-lg font-bold text-navy">{testItem.test_item_name}</span>
        <span className="text-sm text-foreground/70">
          容器コード: {testItem.container_code}
          {container && `（${containerLabel(container)}）`}
        </span>
      </Link>
    </li>
  );
}
