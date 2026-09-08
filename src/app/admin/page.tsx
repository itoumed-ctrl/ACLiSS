"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AccessLog } from "@/lib/types";
import { BackNav } from "@/components/BackNav";
import { AdminGate } from "@/components/admin/AdminGate";
import { clearFaceId, isFaceIdAvailable, setupFaceId } from "@/lib/faceIdUnlock";

export default function AdminPage() {
  return (
    <AdminGate title="ACLiSS 管理画面">
      {({ passcode, onPasscodeChange, faceIdSetup, onFaceIdSetupChange }) => (
        <AdminDashboard
          passcode={passcode}
          onPasscodeChange={onPasscodeChange}
          faceIdSetup={faceIdSetup}
          onFaceIdSetupChange={onFaceIdSetupChange}
        />
      )}
    </AdminGate>
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
      <Link
        href="/admin/master"
        prefetch={false}
        className="flex flex-col gap-1 rounded-lg border-2 border-navy/20 bg-white px-5 py-5 active:bg-navy/5"
      >
        <span className="text-xl font-bold text-navy">📋 マスタ管理</span>
        <span className="text-sm text-foreground/70">
          容器・検査項目マスタのCSV一括更新／個別編集、容器写真のアップロード
        </span>
      </Link>
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
