"use client";

import { useState } from "react";
import { BackNav } from "@/components/BackNav";
import { AdminGate } from "@/components/admin/AdminGate";
import { ContainerMasterPanel } from "@/components/admin/ContainerMasterPanel";
import { TestItemMasterPanel } from "@/components/admin/TestItemMasterPanel";

export default function AdminMasterPage() {
  return (
    <AdminGate title="ACLiSS マスタ管理">
      {({ passcode }) => <MasterDashboard passcode={passcode} />}
    </AdminGate>
  );
}

function MasterDashboard({ passcode }: { passcode: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8">
      <BackNav />
      <h1 className="text-xl font-bold text-navy">マスタ管理</h1>
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
      <ContainerMasterPanel passcode={passcode} />
      <TestItemMasterPanel passcode={passcode} />
      <ImageUploadForm passcode={passcode} />
      <BulkImageUploadForm passcode={passcode} />
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
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/admin/export?type=${type}`, {
        headers: { "x-admin-passcode": passcode },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setDownloadError(json?.error ?? "ダウンロードに失敗しました");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `${type}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("通信エラーが発生しました");
    } finally {
      setDownloading(false);
    }
  }

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
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="self-start rounded border border-navy/30 px-3 py-1.5 text-sm text-navy disabled:opacity-50"
        >
          {downloading ? "ダウンロード中..." : "⬇ 現在のマスタをCSVでダウンロード"}
        </button>
        <p className="text-xs text-foreground/50">
          ダウンロードしたCSVを編集して、下からそのままアップロードできます。
        </p>
        {downloadError && <p className="text-xs text-red-600">{downloadError}</p>}
      </div>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full max-w-full"
      />
      <label className="text-sm">
        実行者名（任意、記録用）
        <input
          type="text"
          value={importedBy}
          onChange={(e) => setImportedBy(e.target.value)}
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
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
        const codes: string[] = json.updatedContainerCodes ?? [];
        setStatus(
          codes.length > 1
            ? `アップロードしました（同じ写真を使う${codes.length}件の容器に反映: ${codes.join("、")}）`
            : "アップロードしました",
        );
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
      <p className="text-sm text-foreground/70">
        同じ写真を複数の容器コードで使い回している場合、マスタの設定に従って
        自動的にまとめて反映されます。
      </p>
      <label className="text-sm">
        容器コード（3桁）
        <input
          type="text"
          value={containerCode}
          onChange={(e) => setContainerCode(e.target.value)}
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
          placeholder="例: 121"
        />
      </label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full max-w-full"
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

type BulkUploadResult = {
  fileName: string;
  containerCode: string;
  status: "success" | "error";
  message?: string;
  reflectedCount?: number;
};

function BulkImageUploadForm({ passcode }: { passcode: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [results, setResults] = useState<BulkUploadResult[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setBusy(true);
    setDoneCount(0);
    setResults(null);

    const newResults: BulkUploadResult[] = [];

    for (const file of files) {
      const containerCode = file.name.replace(/\.[^.]+$/, "").trim();

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
          newResults.push({
            fileName: file.name,
            containerCode,
            status: "error",
            message: json.error ?? "アップロードに失敗しました",
          });
        } else {
          const reflectedCount: number = json.updatedContainerCodes?.length ?? 1;
          newResults.push({ fileName: file.name, containerCode, status: "success", reflectedCount });
        }
      } catch {
        newResults.push({
          fileName: file.name,
          containerCode,
          status: "error",
          message: "通信エラーが発生しました",
        });
      }

      setDoneCount((n) => n + 1);
    }

    setResults(newResults);
    setBusy(false);
  }

  const successCount = results?.filter((r) => r.status === "success").length ?? 0;
  const failures = results?.filter((r) => r.status === "error") ?? [];
  const totalReflected = results
    ?.filter((r) => r.status === "success")
    .reduce((sum, r) => sum + (r.reflectedCount ?? 1), 0);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-navy/20 p-4"
    >
      <h2 className="font-semibold text-navy">容器写真のまとめてアップロード</h2>
      <p className="text-sm text-foreground/70">
        ファイル名を容器コードにしてください（例: 「073.png」→ 容器コード073）。
        複数選択できます。同じ写真を使い回している容器コードには自動的に反映されます。
      </p>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className="w-full max-w-full"
      />
      {files.length > 0 && (
        <p className="text-sm text-foreground/70">{files.length}枚選択中</p>
      )}
      <button
        type="submit"
        disabled={files.length === 0 || busy}
        className="self-start rounded bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? `アップロード中... (${doneCount}/${files.length})` : "まとめてアップロードする"}
      </button>

      {results && (
        <div className="text-sm">
          <p>
            成功: {successCount}件 / 失敗: {failures.length}件
            {typeof totalReflected === "number" && totalReflected > successCount && (
              <>（使い回しを含め、容器マスタ{totalReflected}件に反映）</>
            )}
          </p>
          {failures.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-red-600">
              {failures.map((f) => (
                <li key={f.fileName}>
                  {f.fileName}（容器コード: {f.containerCode}）: {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
