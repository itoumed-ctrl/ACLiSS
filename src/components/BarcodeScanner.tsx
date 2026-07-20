"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { extractContainerCodeFromBarcode, extractContainerCodeFromLabelDigits } from "@/lib/barcode";

// 検査バーコードは1次元バーコード。よく使われる形式に絞ると精度・速度が上がる。
const ZXING_HINTS = new Map<DecodeHintType, unknown>([
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

const NATIVE_FORMATS = ["code_128", "itf", "code_39", "codabar", "ean_13"];

// カメラの解像度が低いと特に1次元バーコードが読み取りにくいため、
// 高めの解像度と連続オートフォーカスを希望する（対応していない端末は無視される）。
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "environment",
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  advanced: [{ focusMode: "continuous" } as unknown as MediaTrackConstraintSet],
};

type ScanStatus = "initializing" | "scanning" | "success";
type ScanEngine = "native" | "zxing" | null;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// getCapabilities()の戻り値にtorchは標準のlib.domの型に含まれていないため、
// 必要な部分だけ緩く型付けする。
type CameraCapabilities = { torch?: boolean };

export function BarcodeScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<ScanStatus>("initializing");
  const [engine, setEngine] = useState<ScanEngine>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [formatError, setFormatError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  const trackRef = useRef<MediaStreamTrack | null>(null);
  const zxingControlsRef = useRef<import("@zxing/browser").IScannerControls | null>(null);

  useEffect(() => {
    let cancelled = false;
    let found = false;
    const cleanupFns: Array<() => void> = [];

    function handleDetected(raw: string) {
      if (cancelled || found) return;
      setLastScanned((prev) => (prev === raw ? prev : raw));
      const code = extractContainerCodeFromBarcode(raw);
      if (code) {
        found = true;
        cleanupFns.forEach((fn) => fn());
        setStatus("success");
        setTimeout(() => router.push(`/containers/${code}`), 400);
      }
    }

    function inspectNativeCapabilities(track: MediaStreamTrack) {
      // タップフォーカス（pointsOfInterest）はtorch非対応端末でも使いたいため、
      // 以前のようにtorch対応時のみでなく、常にtrackを保持しておく。
      trackRef.current = track;
      try {
        const capabilities = track.getCapabilities?.() as CameraCapabilities | undefined;
        if (capabilities?.torch) {
          setTorchSupported(true);
        }
      } catch {
        // 対応確認に失敗しても致命的ではないので無視する
      }
    }

    async function startNative(): Promise<boolean> {
      if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
        return false;
      }
      const supported = await BarcodeDetector.getSupportedFormats().catch(
        (): string[] => [],
      );
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (formats.length === 0) return false;

      const detector = new BarcodeDetector({ formats });
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return true;
      }

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      video.srcObject = stream;
      await video.play();
      inspectNativeCapabilities(stream.getVideoTracks()[0]);

      setEngine("native");
      setStatus("scanning");

      let rafId = 0;
      let busy = false;
      const tick = () => {
        if (cancelled) return;
        if (!busy && video.readyState >= 2) {
          busy = true;
          detector
            .detect(video)
            .then((barcodes) => {
              if (barcodes.length > 0) handleDetected(barcodes[0].rawValue);
            })
            .catch(() => {
              // 1フレームの検出失敗は無視して次に進む
            })
            .finally(() => {
              busy = false;
            });
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      cleanupFns.push(() => {
        cancelAnimationFrame(rafId);
        stream.getTracks().forEach((t) => t.stop());
      });
      return true;
    }

    async function startZxing() {
      const codeReader = new BrowserMultiFormatReader(ZXING_HINTS);
      const controls = await codeReader.decodeFromConstraints(
        { video: VIDEO_CONSTRAINTS },
        videoRef.current!,
        (result) => {
          if (result) handleDetected(result.getText());
        },
      );
      if (cancelled) {
        controls.stop();
        return;
      }
      zxingControlsRef.current = controls;
      setEngine("zxing");
      setStatus("scanning");
      try {
        const capabilities = controls.streamVideoCapabilitiesGet?.(
          (track) => [track],
        ) as CameraCapabilities | undefined;
        if (capabilities?.torch) {
          setTorchSupported(true);
        }
      } catch {
        // 対応確認に失敗しても致命的ではないので無視する
      }
      cleanupFns.push(() => controls.stop());
    }

    startNative()
      .then((started) => {
        if (!started && !cancelled) return startZxing();
      })
      .catch((e) => {
        if (!cancelled) {
          setCameraError(
            e instanceof Error
              ? e.message
              : "カメラを起動できませんでした。カメラの利用を許可してください。",
          );
        }
      });

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
    };
  }, [router]);

  async function toggleTorch() {
    const next = !torchOn;
    try {
      if (engine === "native" && trackRef.current) {
        await trackRef.current.applyConstraints({
          advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
        });
      } else if (engine === "zxing") {
        await zxingControlsRef.current?.switchTorch?.(next);
      }
      setTorchOn(next);
    } catch {
      // 端末が対応していない場合は何もしない
    }
  }

  // タップした位置にフォーカスを送る。対応端末（主にAndroid）では実際にその
  // 位置へフォーカスが移動する。非対応端末（iPhoneのSafari等）ではブラウザが
  // タップ位置でのフォーカス制御に対応していないため実際の効果は無いが、
  // 何度もエラーにはならず、タップ自体がオートフォーカスの再試行のきっかけに
  // なることもあるため、無害な形で試行する。
  async function applyAdvancedConstraint(constraint: Record<string, unknown>) {
    try {
      const advanced = [constraint as unknown as MediaTrackConstraintSet];
      if (engine === "native" && trackRef.current) {
        await trackRef.current.applyConstraints({ advanced });
      } else if (engine === "zxing") {
        zxingControlsRef.current?.streamVideoConstraintsApply?.({ advanced });
      }
    } catch {
      // 対応していない端末では何も起きないため無視してよい
    }
  }

  function handleVideoTap(e: React.MouseEvent<HTMLVideoElement>) {
    const video = e.currentTarget;
    const rect = video.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const tapY = e.clientY - rect.top;

    // タップした場所にフォーカスリングを一瞬表示（対応端末かどうかに関わらず、
    // タップが反応したことが分かるようにする）。
    setFocusPoint({ x: tapX, y: tapY });
    window.setTimeout(() => setFocusPoint(null), 700);

    // <video>はobject-fit: coverで表示しているため、実際のカメラ映像の座標に
    // 変換する（表示領域と映像本来の縦横比が異なると、はみ出た部分が
    // トリミングされて表示されているため）。
    const videoWidth = video.videoWidth || rect.width;
    const videoHeight = video.videoHeight || rect.height;
    const scale = Math.max(rect.width / videoWidth, rect.height / videoHeight);
    const offsetX = (rect.width - videoWidth * scale) / 2;
    const offsetY = (rect.height - videoHeight * scale) / 2;
    const normalizedX = clamp01((tapX - offsetX) / (videoWidth * scale));
    const normalizedY = clamp01((tapY - offsetY) / (videoHeight * scale));

    applyAdvancedConstraint({
      pointsOfInterest: [{ x: normalizedX, y: normalizedY }],
      focusMode: "single-shot",
    }).then(() => {
      // 単発フォーカス後は、通常の連続オートフォーカスに戻す。
      window.setTimeout(() => {
        applyAdvancedConstraint({ focusMode: "continuous" });
      }, 1200);
    });
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = manualInput.trim();
    const code = extractContainerCodeFromLabelDigits(trimmed);
    if (!code) {
      setFormatError("11桁の数字で入力してください（ラベルに印字されている数字をそのまま）");
      return;
    }
    setFormatError(null);
    router.push(`/containers/${code}`);
  }

  return (
    <div>
      {!cameraError && (
        <div className="relative mb-4">
          <video
            ref={videoRef}
            onClick={handleVideoTap}
            className={`aspect-[4/3] w-full rounded-lg border-4 bg-black object-cover transition-colors ${
              status === "success" ? "border-green-500" : "border-navy/20"
            }`}
            muted
            playsInline
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1/3 w-4/5 rounded-lg border-2 border-gold/80" />
          </div>
          {focusPoint && (
            <div
              className="pointer-events-none absolute h-16 w-16 rounded-full border-2 border-gold"
              style={{ left: focusPoint.x, top: focusPoint.y, animation: "acliss-focus-ring 0.7s ease-out" }}
            />
          )}
          <div className="absolute left-0 right-0 top-2 flex justify-center">
            <StatusBadge status={status} />
          </div>
          {torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`absolute bottom-2 right-2 rounded-full px-3 py-2 text-sm font-semibold ${
                torchOn ? "bg-gold text-navy" : "bg-black/60 text-white"
              }`}
            >
              {torchOn ? "💡 ライトを消す" : "💡 ライトをつける"}
            </button>
          )}
        </div>
      )}

      {cameraError && (
        <p className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
          カメラを利用できません: {cameraError}
          <br />
          下の欄にラベルの11桁の数字を直接入力してください。
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
        カメラがうまく読み取れない場合は、ラベルの11桁の数字を直接入力できます。
      </p>
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="例: 00000000121"
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
