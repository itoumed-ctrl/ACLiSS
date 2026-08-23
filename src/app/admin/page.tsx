"use client";

import { useEffect, useState } from "react";
import type { AccessLog } from "@/lib/types";
import { BackNav } from "@/components/BackNav";
import { ContainerMasterPanel } from "@/components/admin/ContainerMasterPanel";
import { TestItemMasterPanel } from "@/components/admin/TestItemMasterPanel";
import {
  clearFaceId,
  hasFaceIdSetup,
  isFaceIdAvailable,
  setupFaceId,
  unlockWithFaceId,
  updateFaceIdPasscode,
} from "@/lib/faceIdUnlock";

const PASSCODE_STORAGE_KEY = "acliss-admin-passcode";

function readSavedPasscode(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PASSCODE_STORAGE_KEY) ?? "";
}

async function verifyPasscode(passcode: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/verify-passcode", {
      method: "POST",
      headers: { "x-admin-passcode": passcode },
    });
    return res.ok;
  } catch {
    return false;
  }
}

type GateStatus = "checking" | "locked" | "unlocked";

export default function AdminPage() {
  const [passcode, setPasscode] = useState(readSavedPasscode);
  const [status, setStatus] = useState<GateStatus>(() =>
    readSavedPasscode() ? "checking" : "locked",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [faceIdBusy, setFaceIdBusy] = useState(false);
  const [faceIdSetup, setFaceIdSetup] = useState(hasFaceIdSetup);

  useEffect(() => {
    const saved = readSavedPasscode();
    if (!saved) return;
    verifyPasscode(saved).then((ok) => {
      if (!ok) sessionStorage.removeItem(PASSCODE_STORAGE_KEY);
      setStatus(ok ? "unlocked" : "locked");
    });
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await verifyPasscode(passcode);
    setBusy(false);
    if (ok) {
      sessionStorage.setItem(PASSCODE_STORAGE_KEY, passcode);
      setStatus("unlocked");
    } else {
      setError("合言葉が違います");
    }
  }

  async function handleFaceIdUnlock() {
    setFaceIdBusy(true);
    setError(null);
    const unlockedPasscode = await unlockWithFaceId();
    if (!unlockedPasscode) {
      setFaceIdBusy(false);
      setError("Face ID / Touch IDでの解錠に失敗しました。合言葉を直接入力してください。");
      return;
    }
    const ok = await verifyPasscode(unlockedPasscode);
    setFaceIdBusy(false);
    if (ok) {
      sessionStorage.setItem(PASSCODE_STORAGE_KEY, unlockedPasscode);
      setPasscode(unlockedPasscode);
      setStatus("unlocked");
    } else {
      // 合言葉が変更された等、この端末に保存されている内容が古い
      clearFaceId();
      setFaceIdSetup(false);
      setError(
        "保存されている情報が古いようです。合言葉を入力し直し、Face ID解錠を設定し直してください。",
      );
    }
  }

  if (status === "checking") {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <BackNav />
        <p className="text-sm text-foreground/60">確認中...</p>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <BackNav />
        <h1 className="mb-4 text-xl font-bold text-navy">ACLiSS 管理画面</h1>
        {faceIdSetup && (
          <button
            type="button"
            onClick={handleFaceIdUnlock}
            disabled={faceIdBusy}
            className="mb-4 w-full rounded border-2 border-navy px-4 py-3 font-semibold text-navy disabled:opacity-50"
          >
            {faceIdBusy ? "認証中..." : "Face ID / Touch IDで開く"}
          </button>
        )}
        <form onSubmit={handleUnlock} className="flex flex-col gap-3">
          <label className="text-sm">
            合言葉（パスコード）
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "確認中..." : "入る"}
          </button>
        </form>
      </div>
    );
  }

  function handlePasscodeChange(newPasscode: string) {
    sessionStorage.setItem(PASSCODE_STORAGE_KEY, newPasscode);
    setPasscode(newPasscode);
    updateFaceIdPasscode(newPasscode);
  }

  return (
    <AdminDashboard
      passcode={passcode}
      onPasscodeChange={handlePasscodeChange}
      faceIdSetup={faceIdSetup}
      onFaceIdSetupChange={setFaceIdSetup}
    />
  );
}

function AdminDashboard({
  passcode,
  onPasscodeChange,
  faceIdSetup,
  onFaceIdSetupChange,
}: {
  passcode: string;
  onPasscodeChange: (newPasscode: string) => void;
  faceIdSetup: boolean;
  onFaceIdSetupChange: (setup: boolean) => void;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8">
      <BackNav />
      <h1 className="text-xl font-bold text-navy">ACLiSS 管理画面</h1>
      <FaceIdSetupPanel
        passcode={passcode}
        faceIdSetup={faceIdSetup}
        onFaceIdSetupChange={onFaceIdSetupChange}
      />
      <MaintenancePanel passcode={passcode} />
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
      <AccessLogList passcode={passcode} />
      <ChangePasscodeForm passcode={passcode} onPasscodeChange={onPasscodeChange} />
    </div>
  );
}

function MaintenancePanel({ passcode }: { passcode: string }) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/maintenance", { headers: { "x-admin-passcode": passcode } })
      .then((res) => res.json())
      .then((json) => {
        if (typeof json.enabled === "boolean") {
          setEnabled(json.enabled);
          setMessage(json.message ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [passcode]);

  async function save(nextEnabled: boolean) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "x-admin-passcode": passcode, "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, message }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`エラー: ${json.error ?? "変更に失敗しました"}`);
      } else {
        setEnabled(nextEnabled);
        setStatus(
          nextEnabled
            ? "メンテナンス中にしました。閲覧側にはメンテナンス画面が表示されます。"
            : "メンテナンスを解除しました。",
        );
      }
    } catch {
      setStatus("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-navy/20 p-4">
      <h2 className="font-semibold text-navy">メンテナンスモード</h2>
      <p className="text-sm text-foreground/70">
        オンにすると、看護師が使う画面（トップ・スキャン・容器一覧・検査項目検索・最低採血量）は
        メンテナンス中の表示になります。この管理画面は引き続き使えます。
      </p>

      <div
        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
          enabled ? "bg-red-50 text-red-700" : "bg-navy/5 text-navy"
        }`}
      >
        <span>
          現在の状態：{loading ? "確認中..." : enabled ? "メンテナンス中" : "通常運用中"}
        </span>
      </div>

      <label className="text-sm">
        メンテナンス中に表示するメッセージ（任意）
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="ただいまメンテナンス中です。しばらくお待ちください。"
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
        />
      </label>

      {enabled ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save(true)}
            disabled={busy || loading}
            className="rounded border-2 border-navy px-4 py-2 font-semibold text-navy disabled:opacity-50"
          >
            {busy ? "保存中..." : "メッセージを更新"}
          </button>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={busy || loading}
            className="rounded bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "保存中..." : "メンテナンスを解除"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy || loading}
          className="self-start rounded bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "保存中..." : "メンテナンス中にする"}
        </button>
      )}

      {status && <p className="text-sm text-foreground/70">{status}</p>}
    </div>
  );
}

function FaceIdSetupPanel({
  passcode,
  faceIdSetup,
  onFaceIdSetupChange,
}: {
  passcode: string;
  faceIdSetup: boolean;
  onFaceIdSetupChange: (setup: boolean) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    isFaceIdAvailable().then(setAvailable);
  }, []);

  if (!available) return null;

  async function handleSetup() {
    setBusy(true);
    setMessage(null);
    const ok = await setupFaceId(passcode);
    setBusy(false);
    if (ok) {
      onFaceIdSetupChange(true);
      setMessage("この端末でFace ID / Touch IDによる解錠を設定しました。");
    } else {
      setMessage("設定に失敗しました。もう一度お試しください。");
    }
  }

  function handleClear() {
    clearFaceId();
    onFaceIdSetupChange(false);
    setMessage("この端末のFace ID / Touch ID設定を解除しました。");
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-navy/20 p-4 text-sm">
      {faceIdSetup ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground/70">
            ✓ この端末はFace ID / Touch IDで解錠できます
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-navy underline"
          >
            解除する
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground/70">
            次回から合言葉の代わりにFace ID / Touch IDで開けるようにできます
          </span>
          <button
            type="button"
            onClick={handleSetup}
            disabled={busy}
            className="shrink-0 rounded bg-navy px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "設定中..." : "設定する"}
          </button>
        </div>
      )}
      {!faceIdSetup && (
        <p className="text-xs text-foreground/50">
          設定すると、合言葉がこの端末に保存されます。共用端末では設定しないでください。
        </p>
      )}
      {message && <p className="text-xs text-foreground/60">{message}</p>}
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

function AccessLogList({ passcode }: { passcode: string }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<AccessLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function fetchLogs() {
    return fetch("/api/admin/access-logs", { headers: { "x-admin-passcode": passcode } })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setLogs(json);
          setError(null);
        } else {
          setError(json.error ?? "取得に失敗しました");
        }
      })
      .catch(() => setError("通信エラーが発生しました"));
  }

  function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = e.currentTarget.open;
    setOpen(isOpen);
    if (isOpen && !logs && !error) {
      fetchLogs();
    }
  }

  function handleRefresh(e: React.MouseEvent) {
    e.preventDefault();
    setRefreshing(true);
    fetchLogs().finally(() => setRefreshing(false));
  }

  return (
    <details
      className="rounded-lg border border-navy/20 p-4"
      onToggle={handleToggle}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold text-navy">
        <span>アクセスログ（直近200件）</span>
        {open && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded border border-navy/30 px-2 py-1 text-xs font-normal text-navy disabled:opacity-50"
          >
            {refreshing ? "更新中..." : "🔄 最新化"}
          </button>
        )}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-foreground/70">
          「管理画面の合言葉認証に成功した時」「容器詳細を開いた時」（バーコード・容器一覧・
          検査項目検索のどこから開いても対象）「最低採血量計算ツールを開いた時」のみ
          表示しています
          （トップページ・容器一覧・検査項目検索の一覧表示、管理画面を開いただけで
          認証が通っていない記録は件数が多くなるため非表示。記録自体はすべて保存しています）。
          閲覧側に合言葉認証をかけていないため、不審なアクセスがないか確認する目的です。
        </p>
        {open && error && <p className="text-sm text-red-600">{error}</p>}
        {open && !error && !logs && <p className="text-sm">読み込み中...</p>}
        {logs && logs.length === 0 && <p className="text-sm">まだ記録がありません</p>}
        {logs && logs.length > 0 && (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-navy/20">
                  <th className="whitespace-nowrap py-1 pr-2">日時</th>
                  <th className="whitespace-nowrap py-1 pr-2">ページ</th>
                  <th className="whitespace-nowrap py-1 pr-2">結果</th>
                  <th className="whitespace-nowrap py-1 pr-2">IPアドレス</th>
                  <th className="whitespace-nowrap py-1 pr-2">ブラウザ情報</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-navy/10 align-top">
                    <td className="whitespace-nowrap py-1 pr-2">
                      {new Date(log.accessed_at).toLocaleString("ja-JP")}
                    </td>
                    <td className="py-1 pr-2 font-mono text-xs">{log.path}</td>
                    <td className="whitespace-nowrap py-1 pr-2 text-xs">
                      {log.event === "admin_login_success" ? (
                        <span className="text-green-700">ログイン成功</span>
                      ) : (
                        "-"
                      )}
                    </td>
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
    </details>
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
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
        />
      </label>
      <label className="text-sm">
        新しいパスワード（確認）
        <input
          type="password"
          value={confirmPasscode}
          onChange={(e) => setConfirmPasscode(e.target.value)}
          className="mt-1 w-full rounded border border-navy/30 px-3 py-2 text-base"
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
