"use client";

import { useMemo, useState } from "react";
import { BackNav } from "@/components/BackNav";
import { TEST_ITEMS, FIELD_ORDER, calculate, ITEMS_BY_ID } from "@/lib/bloodVolume";

export default function BloodVolumePage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const result = useMemo(() => calculate([...selected]), [selected]);

  const itemsByField = useMemo(() => {
    const map = new Map<string, typeof TEST_ITEMS>();
    for (const field of FIELD_ORDER) map.set(field, []);
    for (const it of TEST_ITEMS) {
      const arr = map.get(it.field);
      if (arr) arr.push(it);
    }
    return map;
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  const hasSelection = selected.size > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* 上部固定：結果サマリー */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-navy/10 bg-background px-4 pb-3 pt-6">
        <BackNav />
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-navy">最低採血量</h1>
          {hasSelection && (
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-navy underline"
            >
              クリア（{selected.size}）
            </button>
          )}
        </div>

        {!hasSelection ? (
          <p className="text-sm text-foreground/60">
            下から検査項目を選ぶと、容器ごとの必要量を計算します
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {result.containers.map((c) => (
              <div
                key={c.container}
                className="flex items-baseline justify-between gap-3 rounded-lg bg-navy/5 px-3 py-2"
              >
                <span className="text-sm font-semibold text-navy">{c.label}</span>
                <span className="whitespace-nowrap text-lg font-bold text-navy">
                  {c.amount} mL
                </span>
              </div>
            ))}
            {result.warnings.map((w) => (
              <p
                key={w}
                className="rounded bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                ⚠ {w}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* 計算の内訳（検算用） */}
      {hasSelection && result.containers.length > 0 && (
        <details className="mt-4 rounded-lg border border-navy/20 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-navy">
            計算の内訳を見る
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            {result.containers.map((c) => (
              <div key={c.container}>
                <p className="font-semibold text-navy">
                  {c.label}：{c.amount} mL
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                  {c.groups.map((g, i) => (
                    <li key={i} className="text-foreground/70">
                      {g.label}：{g.amount} mL
                      <span className="text-foreground/45">（{g.items.join("、")}）</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="border-t border-navy/10 pt-2 font-semibold text-navy">
              全容器の合計：{result.total} mL
            </p>
          </div>
        </details>
      )}

      {/* 注意事項 */}
      <details className="mt-4 rounded-lg border border-navy/20 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-navy">注意事項</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-foreground/70">
          <li>生化学・免疫項目（茶・黄ミニコレクト）の量は血清量です。採取量（全血）ではありません。</li>
          <li>ヘマトクリット値やフィブリン析出等により、血清・血漿が予想より少なくなることがあります。</li>
          <li>原則、初回値のみの血清・血漿量です。</li>
          <li>あくまで目安であり、組み合わせによっては表示量と実際が異なる場合があります。</li>
          <li>0.1 mL ＝ 100 μL</li>
        </ul>
      </details>

      {/* 分野別 項目ボタン */}
      <div className="mt-6 flex flex-col gap-6">
        {FIELD_ORDER.map((field) => {
          const items = itemsByField.get(field) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={field}>
              <h2 className="mb-2 text-lg font-bold text-navy">{field}</h2>
              <div className="flex flex-wrap gap-2">
                {items.map((it) => {
                  const active = selected.has(it.id);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => toggle(it.id)}
                      aria-pressed={active}
                      className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? "border-navy bg-navy text-white"
                          : "border-navy/25 bg-white text-navy active:bg-navy/5"
                      }`}
                    >
                      {it.name}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* 選択中の項目に注記があれば表示 */}
      {hasSelection && (
        <SelectedNotes selectedIds={[...selected]} />
      )}
    </div>
  );
}

function SelectedNotes({ selectedIds }: { selectedIds: string[] }) {
  const notes = selectedIds
    .map((id) => ITEMS_BY_ID[id])
    .filter((it) => it?.note)
    .map((it) => ({ name: it.name, note: it.note as string }));

  if (notes.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-gold/50 bg-gold/10 p-3 text-sm">
      <p className="mb-1 font-semibold text-navy">選択中の項目の補足</p>
      <ul className="flex flex-col gap-1 text-foreground/75">
        {notes.map((n, i) => (
          <li key={i}>
            <span className="font-semibold">{n.name}</span>：{n.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
