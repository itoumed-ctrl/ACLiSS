"use client";

import { useState } from "react";
import type { Container, TestItem } from "@/lib/types";

type TestItemFormState = {
  test_item_code: string;
  test_item_name: string;
  container_code: string;
};

const EMPTY_FORM: TestItemFormState = {
  test_item_code: "",
  test_item_name: "",
  container_code: "",
};

function toFormState(t: TestItem): TestItemFormState {
  return {
    test_item_code: t.test_item_code,
    test_item_name: t.test_item_name,
    container_code: t.container_code ?? "",
  };
}

export function TestItemMasterPanel({ passcode }: { passcode: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TestItem[] | null>(null);
  const [containerOptions, setContainerOptions] = useState<Container[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // null = 編集フォーム非表示、"" = 新規追加、それ以外 = 編集中の検査項目コード
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<TestItemFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadItems() {
    return fetch("/api/test-items")
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setItems(json);
          setLoadError(null);
        } else {
          setLoadError(json.error ?? "取得に失敗しました");
        }
      })
      .catch(() => setLoadError("通信エラーが発生しました"));
  }

  function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = e.currentTarget.open;
    setOpen(isOpen);
    if (isOpen && !items && !loadError) {
      loadItems();
      fetch("/api/containers")
        .then((res) => res.json())
        .then((json) => {
          if (Array.isArray(json)) setContainerOptions(json);
        })
        .catch(() => {
          // 容器コード候補が取れなくても、手入力できるので致命的ではない
        });
    }
  }

  function startNew() {
    setForm(EMPTY_FORM);
    setEditingCode("");
    setSaveError(null);
  }

  function startEdit(t: TestItem) {
    setForm(toFormState(t));
    setEditingCode(t.test_item_code);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingCode(null);
    setSaveError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const code = form.test_item_code.trim();
    const name = form.test_item_name.trim();
    if (!code || !name) {
      setSaveError("検査項目コードと検査項目名は必須です");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/test-items", {
        method: "POST",
        headers: { "x-admin-passcode": passcode, "content-type": "application/json" },
        body: JSON.stringify({
          test_item_code: code,
          test_item_name: name,
          container_code: form.container_code.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? "保存に失敗しました");
        return;
      }
      setEditingCode(null);
      await loadItems();
    } catch {
      setSaveError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(code: string) {
    if (!window.confirm(`検査項目コード "${code}" を削除します。元に戻せません。よろしいですか？`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/test-items/${encodeURIComponent(code)}`, {
        method: "DELETE",
        headers: { "x-admin-passcode": passcode },
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? "削除に失敗しました");
        return;
      }
      setEditingCode(null);
      await loadItems();
    } catch {
      setSaveError("通信エラーが発生しました");
    } finally {
      setDeleting(false);
    }
  }

  const trimmedQuery = query.trim().toLowerCase();
  const results =
    items && trimmedQuery
      ? items
          .filter(
            (t) =>
              t.test_item_code.toLowerCase().includes(trimmedQuery) ||
              t.test_item_name.toLowerCase().includes(trimmedQuery),
          )
          .slice(0, 100)
      : [];

  return (
    <details className="rounded-lg border border-navy/20 p-4" onToggle={handleToggle}>
      <summary className="cursor-pointer font-semibold text-navy">
        検査項目マスタの管理（個別に追加・編集・削除）
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-foreground/70">
          検査項目コード・検査項目名で検索できます。CSVでの一括更新は上のフォームから行えます。
        </p>
        {open && loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {open && !loadError && !items && <p className="text-sm">読み込み中...</p>}

        {items && (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="検査項目コード・項目名で検索"
                className="flex-1 rounded border border-navy/30 px-3 py-2 text-base"
              />
              <button
                type="button"
                onClick={startNew}
                className="rounded bg-navy px-3 py-2 text-sm font-semibold text-white"
              >
                ＋新規追加
              </button>
            </div>

            {trimmedQuery === "" && (
              <p className="text-sm text-foreground/50">
                全{items.length}件。検索すると一覧が表示されます。
              </p>
            )}
            {trimmedQuery !== "" && results.length === 0 && (
              <p className="text-sm text-foreground/50">該当する検査項目がありません</p>
            )}
            {results.length > 0 && (
              <div className="max-h-72 overflow-auto rounded border border-navy/10">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {results.map((t) => (
                      <tr key={t.test_item_code} className="border-b border-navy/10">
                        <td className="whitespace-nowrap py-1.5 pl-2 pr-2 font-mono text-xs">
                          {t.test_item_code}
                        </td>
                        <td className="py-1.5 pr-2 text-xs">{t.test_item_name}</td>
                        <td className="whitespace-nowrap py-1.5 pr-2 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            className="text-xs font-semibold text-navy underline"
                          >
                            編集
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {editingCode !== null && (
          <form
            onSubmit={handleSave}
            className="mt-2 flex flex-col gap-3 rounded-lg border border-gold/60 bg-gold/5 p-4"
          >
            <h3 className="font-semibold text-navy">
              {editingCode === "" ? "検査項目を新規追加" : `検査項目コード "${editingCode}" を編集`}
            </h3>

            <label className="text-sm">
              検査項目コード *
              <input
                type="text"
                value={form.test_item_code}
                onChange={(e) => setForm({ ...form, test_item_code: e.target.value })}
                disabled={editingCode !== ""}
                required
                className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base disabled:bg-navy/5"
              />
            </label>
            {editingCode !== "" && (
              <p className="-mt-2 text-xs text-foreground/50">検査項目コードは変更できません。</p>
            )}

            <label className="text-sm">
              検査項目名 *
              <input
                type="text"
                value={form.test_item_name}
                onChange={(e) => setForm({ ...form, test_item_name: e.target.value })}
                required
                className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
              />
            </label>

            <label className="text-sm">
              容器コード
              <input
                type="text"
                list="acliss-container-code-options"
                value={form.container_code}
                onChange={(e) => setForm({ ...form, container_code: e.target.value })}
                className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
              />
              <datalist id="acliss-container-code-options">
                {containerOptions.map((c) => (
                  <option key={c.container_code} value={c.container_code}>
                    {c.vessel ?? ""}
                  </option>
                ))}
              </datalist>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存する"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded border border-navy/30 px-4 py-2 text-navy"
              >
                キャンセル
              </button>
              {editingCode !== "" && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingCode)}
                  disabled={deleting}
                  className="ml-auto rounded border border-red-300 px-4 py-2 text-red-600 disabled:opacity-50"
                >
                  {deleting ? "削除中..." : "この検査項目を削除"}
                </button>
              )}
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </form>
        )}
      </div>
    </details>
  );
}
