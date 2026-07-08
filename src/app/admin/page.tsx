"use client";

import { useEffect, useState } from "react";
import type { Container } from "@/lib/types";

const PASSCODE_STORAGE_KEY = "acliss-admin-passcode";

function readSavedPasscode(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PASSCODE_STORAGE_KEY) ?? "";
}

export default function AdminPage() {
  const [passcode, setPasscode] = useState(readSavedPasscode);
  const [unlocked, setUnlocked] = useState(() => readSavedPasscode() !== "");

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    sessionStorage.setItem(PASSCODE_STORAGE_KEY, passcode);
    setUnlocked(true);
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="mb-4 text-xl font-bold text-navy">ACLiSS 管理画面</h1>
        <form onSubmit={handleUnlock} className="flex flex-col gap-3">
          <label className="text-sm">
            合言葉（パスコード）
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="mt-1 w-full rounded border border-navy/30 px-3 py-2"
              autoFocus
            />
          </label>
          <button
            type="submit"
            className="rounded bg-navy px-4 py-2 font-semibold text-white"
          >
            入る
          </button>
        </form>
      </div>
    );
  }

  function handlePasscodeChange(newPasscode: string) {
    sessionStorage.setItem(PASSCODE_STORAGE_KEY, newPasscode);
    setPasscode(newPasscode);
  }

  return <AdminDashboard passcode={passcode} onPasscodeChange={handlePasscodeChange} />;
}

function AdminDashboard({
  passcode,
  onPasscodeChange,
}: {
  passcode: string;
  onPasscodeChange: (newPasscode: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8">
      <h1 className="text-xl font-bold text-navy">ACLiSS 管理画面</h1>
      <ImportForm
        title="容器マスタCSVのアップロード（材料シート）"
        type="containers"
        passcode={passcode}
      />
      <ImportForm
        title="検査項目マスタCSVのアップロード（オーダ可能項目シート）"
        type="test_items"
        passcode={passcode}
      />
      <ImageUploadForm passcode={passcode} />
      <ContainerList />
      <ChangePasscodeForm passcode={passcode} onPasscodeChange={onPasscodeChange} />
    </div>
  );
}

function ImportForm({
  title,
  type,
  passcode,
}: {
  title: string;
  type: "containers" | "test_items";
  passcode: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importedBy, setImportedBy] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setStatus(null);

    const formData = new FormData();
    formData.set("type", type);
    formData.set("file", file);
    formData.set("importedBy", importedBy);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "x-admin-passcode": passcode },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`エラー: ${json.error ?? "取り込みに失敗しました"}`);
      } else {
        setStatus(`${json.imported}件を取り込みました`);
      }
    } catch {
      setStatus("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-navy/20 p-4"
    >
      <h2 className="font-semibold text-navy">{title}</h2>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <label className="text-sm">
        実行者名（任意、記録用）
        <input
          type="text"
          value={importedBy}
          onChange={(e) => setImportedBy(e.target.value)}
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={!file || busy}
        className="self-start rounded bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "取り込み中..." : "取り込む"}
      </button>
      {status && <p className="text-sm">{status}</p>}
    </form>
  );
}

function ImageUploadForm({ passcode }: { passcode: string }) {
  const [containerCode, setContainerCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !containerCode) return;
    setBusy(true);
    setStatus(null);

    const formData = new FormData();
    formData.set("containerCode", containerCode);
    formData.set("file", file);

    try {
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: { "x-admin-passcode": passcode },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`エラー: ${json.error ?? "アップロードに失敗しました"}`);
      } else {
        setStatus("アップロードしました");
      }
    } catch {
      setStatus("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-navy/20 p-4"
    >
      <h2 className="font-semibold text-navy">容器写真のアップロード</h2>
      <label className="text-sm">
        容器コード（3桁）
        <input
          type="text"
          value={containerCode}
          onChange={(e) => setContainerCode(e.target.value)}
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2"
          placeholder="例: 121"
        />
      </label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="submit"
        disabled={!file || !containerCode || busy}
        className="self-start rounded bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "アップロード中..." : "アップロードする"}
      </button>
      {status && <p className="text-sm">{status}</p>}
    </form>
  );
}

function ContainerList() {
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/containers")
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setContainers(json);
        } else {
          setError(json.error ?? "取得に失敗しました");
        }
      })
      .catch(() => setError("通信エラーが発生しました"));
  }, []);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-navy/20 p-4">
      <h2 className="font-semibold text-navy">容器マスタ一覧</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !containers && <p className="text-sm">読み込み中...</p>}
      {containers && containers.length === 0 && (
        <p className="text-sm">まだデータがありません</p>
      )}
      {containers && containers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-navy/20">
                <th className="py-1 pr-2">容器コード</th>
                <th className="py-1 pr-2">VESSEL</th>
                <th className="py-1 pr-2">払い出し場所</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr key={c.container_code} className="border-b border-navy/10">
                  <td className="py-1 pr-2">{c.container_code}</td>
                  <td className="py-1 pr-2">{c.vessel}</td>
                  <td className="py-1 pr-2">{c.dispense_location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChangePasscodeForm({
  passcode,
  onPasscodeChange,
}: {
  passcode: string;
  onPasscodeChange: (newPasscode: string) => void;
}) {
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (newPasscode.length < 4) {
      setStatus("エラー: 新しいパスワードは4文字以上にしてください");
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setStatus("エラー: 確認用のパスワードが一致しません");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/change-passcode", {
        method: "POST",
        headers: {
          "x-admin-passcode": passcode,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPasscode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`エラー: ${json.error ?? "変更に失敗しました"}`);
      } else {
        onPasscodeChange(newPasscode);
        setNewPasscode("");
        setConfirmPasscode("");
        setStatus("パスワードを変更しました");
      }
    } catch {
      setStatus("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-navy/20 p-4"
    >
      <h2 className="font-semibold text-navy">管理画面のパスワードを変更</h2>
      <label className="text-sm">
        新しいパスワード
        <input
          type="password"
          value={newPasscode}
          onChange={(e) => setNewPasscode(e.target.value)}
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2"
        />
      </label>
      <label className="text-sm">
        新しいパスワード（確認）
        <input
          type="password"
          value={confirmPasscode}
          onChange={(e) => setConfirmPasscode(e.target.value)}
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={!newPasscode || !confirmPasscode || busy}
        className="self-start rounded bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "変更中..." : "変更する"}
      </button>
      {status && <p className="text-sm">{status}</p>}
    </form>
  );
}
