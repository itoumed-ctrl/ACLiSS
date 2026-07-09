"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { extractContainerCodeFromBarcode } from "@/lib/barcode";
import { BackNav } from "@/components/BackNav";

// 検査バーコードは1次元バーコード。よく使われる形式に絞ると精度・速度が上がる。
const HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.CODE_128,
      BarcodeFormat.ITF,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODABAR,
      BarcodeFormat.EAN_13,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

type ScanStatus = "initializing" | "scanning" | "success";

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<ScanStatus>("initializing");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [formatError, setFormatError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader(HINTS);
    let cancelled = false;
    let controls: { stop: () => void } | null = null;

    codeReader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result) => {
          if (cancelled || !result) return;
          const raw = result.getText();
          setLastScanned(raw);
          const code = extractContainerCodeFromBarcode(raw);
          if (code) {
            cancelled = true;
            controls?.stop();
            setStatus("success");
            setTimeout(() => router.push(`/containers/${code}`), 400);
          }
        },
      )
      .then((c) => {
        controls = c;
        if (!cancelled) setStatus("scanning");
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
      <BackNav />
      <h1 className="mb-4 text-2xl font-bold text-navy">バーコードをスキャン</h1>

      {!cameraError && (
        <div className="relative mb-4">
          <video
            ref={videoRef}
            className={`w-full rounded-lg border-4 bg-black transition-colors ${
              status === "success" ? "border-green-500" : "border-navy/20"
            }`}
            muted
            playsInline
          />
          <div className="absolute left-0 right-0 top-2 flex justify-center">
            <StatusBadge status={status} />
          </div>
        </div>
      )}

      {cameraError && (
        <p className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
          カメラを利用できません: {cameraError}
          <br />
          下の欄にバーコードの12桁の数字を直接入力してください。
        </p>
      )}

      {lastScanned && (
        <p className="mb-4 rounded-lg bg-navy/5 p-3 text-sm text-navy">
          読み取った内容: <span className="font-mono">{lastScanned}</span>
          <br />
          12桁の数字として認識できなかったため、容器コードへ変換できませんでした。
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

function StatusBadge({ status }: { status: ScanStatus }) {
  if (status === "initializing") {
    return (
      <span className="rounded-full bg-black/60 px-3 py-1 text-sm text-white">
        カメラを起動中...
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className="rounded-full bg-green-600 px-3 py-1 text-sm font-semibold text-white">
        ✓ 読み取り完了
      </span>
    );
  }
  return (
    <span className="rounded-full bg-black/60 px-3 py-1 text-sm text-white">
      スキャン中...
    </span>
  );
}
