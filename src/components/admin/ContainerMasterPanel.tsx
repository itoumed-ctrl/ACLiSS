"use client";

import { useState } from "react";
import type { Container } from "@/lib/types";

type ContainerFormState = {
  container_code: string;
  vessel: string;
  material: string;
  dispense_location: string;
  dispense_phs: string;
  inquiry_dept: string;
  inquiry_phs: string;
  item_count: string;
  collection_amount: string;
  representative_item_code: string;
  test_summary: string;
  has_instruction: boolean;
  instruction_1: string;
  instruction_2: string;
  instruction_3: string;
  notes: string;
};

const EMPTY_FORM: ContainerFormState = {
  container_code: "",
  vessel: "",
  material: "",
  dispense_location: "",
  dispense_phs: "",
  inquiry_dept: "",
  inquiry_phs: "",
  item_count: "",
  collection_amount: "",
  representative_item_code: "",
  test_summary: "",
  has_instruction: false,
  instruction_1: "",
  instruction_2: "",
  instruction_3: "",
  notes: "",
};

function toFormState(c: Container): ContainerFormState {
  return {
    container_code: c.container_code,
    vessel: c.vessel ?? "",
    material: c.material ?? "",
    dispense_location: c.dispense_location ?? "",
    dispense_phs: c.dispense_phs ?? "",
    inquiry_dept: c.inquiry_dept ?? "",
    inquiry_phs: c.inquiry_phs ?? "",
    item_count: c.item_count != null ? String(c.item_count) : "",
    collection_amount: c.collection_amount ?? "",
    representative_item_code: c.representative_item_code ?? "",
    test_summary: c.test_summary ?? "",
    has_instruction: c.has_instruction,
    instruction_1: c.instruction_1 ?? "",
    instruction_2: c.instruction_2 ?? "",
    instruction_3: c.instruction_3 ?? "",
    notes: c.notes ?? "",
  };
}

export function ContainerMasterPanel({ passcode }: { passcode: string }) {
  const [open, setOpen] = useState(false);
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // null = 編集フォーム非表示、"" = 新規追加、それ以外 = 編集中の容器コード
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<ContainerFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadContainers() {
    return fetch("/api/containers")
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setContainers(json);
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
    if (isOpen && !containers && !loadError) {
      loadContainers();
    }
  }

  function startNew() {
    setForm(EMPTY_FORM);
    setEditingCode("");
    setSaveError(null);
  }

  function startEdit(c: Container) {
    setForm(toFormState(c));
    setEditingCode(c.container_code);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingCode(null);
    setSaveError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const code = form.container_code.trim();
    if (!code) {
      setSaveError("容器コードは必須です");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/containers", {
        method: "POST",
        headers: { "x-admin-passcode": passcode, "content-type": "application/json" },
        body: JSON.stringify({ ...form, container_code: code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? "保存に失敗しました");
        return;
      }
      setEditingCode(null);
      await loadContainers();
    } catch {
      setSaveError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(code: string) {
    if (!window.confirm(`容器コード "${code}" を削除します。元に戻せません。よろしいですか？`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/containers/${encodeURIComponent(code)}`, {
        method: "DELETE",
        headers: { "x-admin-passcode": passcode },
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? "削除に失敗しました");
        return;
      }
      setEditingCode(null);
      await loadContainers();
    } catch {
      setSaveError("通信エラーが発生しました");
    } finally {
      setDeleting(false);
    }
  }

  const trimmedQuery = query.trim().toLowerCase();
  const results =
    containers && trimmedQuery
      ? containers
          .filter(
            (c) =>
              c.container_code.toLowerCase().includes(trimmedQuery) ||
              (c.vessel ?? "").toLowerCase().includes(trimmedQuery) ||
              (c.material ?? "").toLowerCase().includes(trimmedQuery),
          )
          .slice(0, 100)
      : [];

  return (
    <details className="rounded-lg border border-navy/20 p-4" onToggle={handleToggle}>
      <summary className="cursor-pointer font-semibold text-navy">
        容器マスタの管理（個別に追加・編集・削除）
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-foreground/70">
          容器コード・種類・材料で検索できます。CSVでの一括更新は上のフォームから行えます。
        </p>
        {open && loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {open && !loadError && !containers && <p className="text-sm">読み込み中...</p>}

        {containers && (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="容器コード・種類・材料で検索"
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
                全{containers.length}件。検索すると一覧が表示されます。
              </p>
            )}
            {trimmedQuery !== "" && results.length === 0 && (
              <p className="text-sm text-foreground/50">該当する容器がありません</p>
            )}
            {results.length > 0 && (
              <div className="max-h-72 overflow-auto rounded border border-navy/10">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {results.map((c) => (
                      <tr key={c.container_code} className="border-b border-navy/10">
                        <td className="whitespace-nowrap py-1.5 pl-2 pr-2 font-mono text-xs">
                          {c.container_code}
                        </td>
                        <td className="py-1.5 pr-2 text-xs">{c.vessel || "(名称未設定)"}</td>
                        <td className="whitespace-nowrap py-1.5 pr-2 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
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
              {editingCode === "" ? "容器を新規追加" : `容器コード "${editingCode}" を編集`}
            </h3>

            <label className="text-sm">
              容器コード *
              <input
                type="text"
                value={form.container_code}
                onChange={(e) => setForm({ ...form, container_code: e.target.value })}
                disabled={editingCode !== ""}
                required
                className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base disabled:bg-navy/5"
              />
            </label>
            {editingCode !== "" && (
              <p className="-mt-2 text-xs text-foreground/50">
                容器コードは変更できません。コード自体を変更したい場合は、新しいコードで追加してから元のコードを削除してください。
              </p>
            )}

            <TextField
              label="種類（VESSEL）"
              value={form.vessel}
              onChange={(v) => setForm({ ...form, vessel: v })}
            />
            <TextField
              label="材料・用途（MATERIAL）"
              value={form.material}
              onChange={(v) => setForm({ ...form, material: v })}
            />
            <TextField
              label="払い出し場所"
              value={form.dispense_location}
              onChange={(v) => setForm({ ...form, dispense_location: v })}
            />
            <TextField
              label="払い出し場所のPHS/内線"
              value={form.dispense_phs}
              onChange={(v) => setForm({ ...form, dispense_phs: v })}
            />
            <TextField
              label="問い合わせ先部署"
              value={form.inquiry_dept}
              onChange={(v) => setForm({ ...form, inquiry_dept: v })}
            />
            <TextField
              label="問い合わせ先のPHS/内線"
              value={form.inquiry_phs}
              onChange={(v) => setForm({ ...form, inquiry_phs: v })}
            />
            <label className="text-sm">
              該当項目数（参考値）
              <input
                type="number"
                value={form.item_count}
                onChange={(e) => setForm({ ...form, item_count: e.target.value })}
                className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
              />
            </label>
            <TextField
              label="規定採取量"
              value={form.collection_amount}
              onChange={(v) => setForm({ ...form, collection_amount: v })}
            />
            <TextField
              label="代表項目コード"
              value={form.representative_item_code}
              onChange={(v) => setForm({ ...form, representative_item_code: v })}
            />
            <TextAreaField
              label="検査項目の概要"
              value={form.test_summary}
              onChange={(v) => setForm({ ...form, test_summary: v })}
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.has_instruction}
                onChange={(e) => setForm({ ...form, has_instruction: e.target.checked })}
                className="h-4 w-4"
              />
              個別の採取指示がある
            </label>
            {form.has_instruction && (
              <>
                <TextField
                  label="採取指示1"
                  value={form.instruction_1}
                  onChange={(v) => setForm({ ...form, instruction_1: v })}
                />
                <TextField
                  label="採取指示2"
                  value={form.instruction_2}
                  onChange={(v) => setForm({ ...form, instruction_2: v })}
                />
                <TextField
                  label="採取指示3"
                  value={form.instruction_3}
                  onChange={(v) => setForm({ ...form, instruction_3: v })}
                />
              </>
            )}
            <TextAreaField
              label="一般的な注意事項"
              value={form.notes}
              onChange={(v) => setForm({ ...form, notes: v })}
            />

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
                  {deleting ? "削除中..." : "この容器を削除"}
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

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
      />
    </label>
  );
}
