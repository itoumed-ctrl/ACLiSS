"use client";

import { useState } from "react";

// 写真ファイルが見つからない・読み込めない場合は、壊れた画像アイコンを出さずに枠ごと隠す。
export function ContainerPhoto({ src, containerCode }: { src: string; containerCode: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`容器コード${containerCode}の写真`}
      onError={() => setFailed(true)}
      className="max-h-80 w-full rounded-lg border border-navy/20 object-contain bg-white"
    />
  );
}
