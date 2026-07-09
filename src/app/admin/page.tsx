"use client";

import { useEffect, useState } from "react";
import type { AccessLog, Container } from "@/lib/types";
import { BackNav } from "@/components/BackNav";

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
        <BackNav />
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
      <BackNav />
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
      <BulkImageUploadForm passcode={passcode} />
      <ContainerList />
      <AccessLogList passcode={passcode} />
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
  const [csvText, setCsvText] = useState("");
  const [importedBy, setImportedBy] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !csvText.trim()) return;
    setBusy(true);
    setStatus(null);

    const formData = new FormData();
    formData.set("type", type);
    if (file) {
      formData.set("file", file);
    } else {
      formData.set("csvText", csvText);
    }
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
        またはCSVの内容をここに貼り付け
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={4}
          placeholder="1行目に列名、2行目以降にデータを貼り付けてください"
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2 font-mono text-xs"
        />
      </label>
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
        disabled={(!file && !csvText.trim()) || busy}
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

function AccessLogList({ passcode }: { passcode: string }) {
  const [logs, setLogs] = useState<AccessLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/access-logs", { headers: { "x-admin-passcode": passcode } })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setLogs(json);
        } else {
          setError(json.error ?? "取得に失敗しました");
        }
      })
      .catch(() => setError("通信エラーが発生しました"));
  }, [passcode]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-navy/20 p-4">
      <h2 className="font-semibold text-navy">アクセスログ（直近200件）</h2>
      <p className="text-sm text-foreground/70">
        看護師が使う画面（トップ・スキャン・容器一覧・容器詳細・検査項目検索）と管理画面への
        アクセスを記録しています。閲覧側に合言葉認証をかけていないため、不審なアクセスがないか
        確認する目的です。
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !logs && <p className="text-sm">読み込み中...</p>}
      {logs && logs.length === 0 && <p className="text-sm">まだ記録がありません</p>}
      {logs && logs.length > 0 && (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-navy/20">
                <th className="py-1 pr-2">日時</th>
                <th className="py-1 pr-2">ページ</th>
                <th className="py-1 pr-2">IPアドレス</th>
                <th className="py-1 pr-2">ブラウザ情報</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-navy/10 align-top">
                  <td className="whitespace-nowrap py-1 pr-2">
                    {new Date(log.accessed_at).toLocaleString("ja-JP")}
                  </td>
                  <td className="py-1 pr-2 font-mono text-xs">{log.path}</td>
                  <td className="whitespace-nowrap py-1 pr-2 font-mono text-xs">
                    {log.ip_address ?? "-"}
                  </td>
                  <td className="max-w-xs truncate py-1 pr-2 text-xs text-foreground/60">
                    {log.user_agent ?? "-"}
                  </td>
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
