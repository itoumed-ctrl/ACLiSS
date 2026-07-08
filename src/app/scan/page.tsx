"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { extractContainerCodeFromBarcode } from "@/lib/barcode";

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [formatError, setFormatError] = useState<string | null>(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    let cancelled = false;
    let controls: { stop: () => void } | null = null;

    codeReader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result) => {
          if (cancelled || !result) return;
          const code = extractContainerCodeFromBarcode(result.getText());
          if (code) {
            cancelled = true;
            controls?.stop();
            router.push(`/containers/${code}`);
          }
        },
      )
      .then((c) => {
        controls = c;
      })
      .catch((e) => {
        setCameraError(
          e instanceof Error
            ? e.message
            : "カメラを起動できませんでした。カメラの利用を許可してください。",
        );
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [router]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = manualInput.trim();
    const code = extractContainerCodeFromBarcode(trimmed);
    if (!code) {
      setFormatError("12桁の数字で入力してください（バーコード印字の数字をそのまま）");
      return;
    }
    setFormatError(null);
    router.push(`/containers/${code}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/" className="mb-4 inline-block text-navy underline">
        ← ホームに戻る
      </Link>
      <h1 className="mb-4 text-2xl font-bold text-navy">バーコードをスキャン</h1>

      {!cameraError && (
        <video
          ref={videoRef}
          className="mb-4 w-full rounded-lg border border-navy/20 bg-black"
          muted
          playsInline
        />
      )}

      {cameraError && (
        <p className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
          カメラを利用できません: {cameraError}
          <br />
          下の欄にバーコードの12桁の数字を直接入力してください。
        </p>
      )}

      <p className="mb-2 text-sm text-foreground/70">
        カメラがうまく読み取れない場合は、バーコード下の12桁の数字を直接入力できます。
      </p>
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="例: 000000001210"
          className="flex-1 rounded border border-navy/30 px-3 py-3 text-lg"
        />
        <button
          type="submit"
          className="rounded bg-navy px-4 py-2 font-semibold text-white"
        >
          検索
        </button>
      </form>
      {formatError && <p className="mt-2 text-sm text-red-600">{formatError}</p>}
    </div>
  );
}
