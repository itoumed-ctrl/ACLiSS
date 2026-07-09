"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMasterData } from "@/lib/useMasterData";
import { UpdatedAtNotice } from "@/components/UpdatedAtNotice";
import { normalizeForSearch } from "@/lib/normalize";
import { containerLabel } from "@/lib/containerLabel";
import { BackNav } from "@/components/BackNav";

export default function ContainersListPage() {
  const { containers, updatedAt, loading, error, isOffline } = useMasterData();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return containers;
    return containers.filter((c) =>
      [c.container_code, c.vessel, c.material, c.test_summary, c.dispense_location]
        .filter(Boolean)
        .some((field) => normalizeForSearch(field!).includes(q)),
    );
  }, [containers, query]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BackNav />
      <h1 className="mb-4 text-2xl font-bold text-navy">容器一覧から選ぶ</h1>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="容器コード・容器の種類・検査項目などで検索"
        className="mb-4 w-full rounded border border-navy/30 px-3 py-3 text-lg"
      />

      <UpdatedAtNotice updatedAt={updatedAt} isOffline={isOffline} />

      {loading && containers.length === 0 && <p>読み込み中...</p>}
      {error && containers.length === 0 && (
        <p className="text-red-600">エラー: {error}</p>
      )}

      <ul className="divide-y divide-navy/10">
        {filtered.map((c) => (
          <li key={c.container_code}>
            <Link
              href={`/containers/${c.container_code}`}
              className="flex flex-col gap-1 py-3 active:bg-navy/5"
            >
              <span className="text-lg font-bold text-navy">
                {c.container_code} {containerLabel(c)}
              </span>
              {c.test_summary && (
                <span className="text-sm text-foreground/70">{c.test_summary}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {!loading && filtered.length === 0 && (
        <p className="py-6 text-center text-foreground/60">該当する容器が見つかりません</p>
      )}
    </div>
  );
}
