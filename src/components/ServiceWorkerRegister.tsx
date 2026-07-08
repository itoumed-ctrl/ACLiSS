"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // オフライン対応が効かないだけなので、失敗しても画面は通常通り使える
      });
    }
  }, []);

  return null;
}
