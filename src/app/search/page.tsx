"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMasterData } from "@/lib/useMasterData";
import { UpdatedAtNotice } from "@/components/UpdatedAtNotice";
import { normalizeForSearch } from "@/lib/normalize";

export default function TestItemSearchPage() {
  const { testItems, updatedAt, loading, error, isOffline } = useMasterData();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return [];
    return testItems
      .filter((t) => normalizeForSearch(t.test_item_name).includes(q))
      .slice(0, 50);
  }, [testItems, query]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/" className="mb-4 inline-block text-navy underline">
        ← ホームに戻る
      </Link>
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
          <li key={t.test_item_code}>
            {t.container_code ? (
              <Link
                href={`/containers/${t.container_code}`}
                className="flex flex-col gap-1 py-3 active:bg-navy/5"
              >
                <span className="text-lg font-bold text-navy">{t.test_item_name}</span>
                <span className="text-sm text-foreground/70">
                  容器コード: {t.container_code}
                </span>
              </Link>
            ) : (
              <div className="flex flex-col gap-1 py-3 text-foreground/50">
                <span className="text-lg">{t.test_item_name}</span>
                <span className="text-sm">対応する容器コードが未設定です</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {query.trim() !== "" && !loading && filtered.length === 0 && (
        <p className="py-6 text-center text-foreground/60">該当する検査項目が見つかりません</p>
      )}
    </div>
  );
}
