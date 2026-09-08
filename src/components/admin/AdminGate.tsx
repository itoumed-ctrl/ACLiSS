"use client";

import { useEffect, useState } from "react";
import { BackNav } from "@/components/BackNav";
import {
  clearFaceId,
  hasFaceIdSetup,
  unlockWithFaceId,
  updateFaceIdPasscode,
} from "@/lib/faceIdUnlock";

const PASSCODE_STORAGE_KEY = "acliss-admin-passcode";
// 合言葉そのものとは別に「このタブで既に確認済みか」を持つ。/adminと/admin/masterの
// ように複数の管理画面を行き来する際、ページを移動するたびにサーバーへ再確認しに
// 行くと毎回一瞬「確認中...」が挟まってしまうため、タブ内で一度確認できていれば
// 以降のページ遷移では再確認をスキップする。
const VERIFIED_STORAGE_KEY = "acliss-admin-verified";

function readSavedPasscode(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PASSCODE_STORAGE_KEY) ?? "";
}

function readVerifiedFlag(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(VERIFIED_STORAGE_KEY) === "1";
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

export interface AdminGateChildProps {
  passcode: string;
  onPasscodeChange: (newPasscode: string) => void;
  faceIdSetup: boolean;
  onFaceIdSetupChange: (setup: boolean) => void;
}

/**
 * 管理画面（/admin, /admin/master 等）共通の合言葉ゲート。
 * 合言葉はsessionStorageに保存するため、一度どちらかの画面で解錠すれば、
 * 同じタブ内で他の管理画面に移動しても再入力は不要になる。
 */
export function AdminGate({
  title,
  children,
}: {
  title: string;
  children: (props: AdminGateChildProps) => React.ReactNode;
}) {
  const [passcode, setPasscode] = useState(readSavedPasscode);
  const [status, setStatus] = useState<GateStatus>(() => {
    const saved = readSavedPasscode();
    if (!saved) return "locked";
    // 同じタブ内で既に確認済みなら、他の管理画面に移動した先で毎回
    // サーバーへ再確認しに行かず、そのまま解錠済みとして扱う。
    return readVerifiedFlag() ? "unlocked" : "checking";
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [faceIdBusy, setFaceIdBusy] = useState(false);
  const [faceIdSetup, setFaceIdSetup] = useState(hasFaceIdSetup);

  useEffect(() => {
    const saved = readSavedPasscode();
    if (!saved || readVerifiedFlag()) return;
    verifyPasscode(saved).then((ok) => {
      if (ok) {
        sessionStorage.setItem(VERIFIED_STORAGE_KEY, "1");
      } else {
        sessionStorage.removeItem(PASSCODE_STORAGE_KEY);
      }
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
      sessionStorage.setItem(VERIFIED_STORAGE_KEY, "1");
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
      sessionStorage.setItem(VERIFIED_STORAGE_KEY, "1");
      setPasscode(unlockedPasscode);
      setStatus("unlocked");
    } else {
      // 合言葉が変更された等、この端末に保存されている情報が古い
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
        <h1 className="mb-4 text-xl font-bold text-navy">{title}</h1>
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
    <>
      {children({
        passcode,
        onPasscodeChange: handlePasscodeChange,
        faceIdSetup,
        onFaceIdSetupChange: setFaceIdSetup,
      })}
    </>
  );
}
