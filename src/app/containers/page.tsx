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
      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pb-3 pt-6">
        <BackNav />
        <h1 className="mb-4 text-2xl font-bold text-navy">容器一覧から選ぶ</h1>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ラベル右下の3桁番号を入力"
          className="mb-2 w-full rounded border border-navy/30 px-3 py-3 text-lg"
        />

        <UpdatedAtNotice updatedAt={updatedAt} isOffline={isOffline} />
      </div>

      {loading && containers.length === 0 && <p>読み込み中...</p>}
      {error && containers.length === 0 && (
        <p className="text-red-600">エラー: {error}</p>
      )}

      <ul className="divide-y divide-navy/10">
        {filtered.map((c) => (
          <li key={c.container_code}>
            <Link
              href={`/containers/${c.container_code}`}
              prefetch={false}
              className="flex items-start gap-4 py-3 active:bg-navy/5"
            >
              <span className="mt-0.5 shrink-0 rounded bg-navy/10 px-2 py-0.5 font-mono text-base font-bold tabular-nums text-navy">
                {c.container_code}
              </span>
              <span className="text-lg font-bold text-navy">{containerLabel(c)}</span>
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
