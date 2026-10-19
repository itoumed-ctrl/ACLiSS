import { useSyncExternalStore } from "react";

// 院内サーバー版はサーバー側の設定（URL書き換え）なしで動かすため、
// 画面の切り替えを「#/containers/121」のようなURLの#以降で行う。
// こうすると index.html を置いたフォルダがどこであっても（例: /acliss/）そのまま動く。

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHash() {
  return window.location.hash.slice(1) || "/";
}

export function useHashLocation() {
  const hash = useSyncExternalStore(subscribe, getHash, () => "/");
  const queryIndex = hash.indexOf("?");
  const path = queryIndex === -1 ? hash : hash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : hash.slice(queryIndex + 1);
  return { path: path || "/", query };
}

export function toHref(href: string) {
  return `#${href}`;
}

export function navigate(href: string, options: { replace?: boolean } = {}) {
  if (options.replace) {
    window.history.replaceState(window.history.state, "", toHref(href));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = href;
  }
}
