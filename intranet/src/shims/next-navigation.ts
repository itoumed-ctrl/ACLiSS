import { useMemo } from "react";
import { navigate, useHashLocation } from "../router";

// 本体（Next.js版）の画面部品をそのまま使うため、next/navigation の代わりに差し込む。

export function useRouter() {
  return useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string, options?: { scroll?: boolean }) => {
        void options;
        navigate(href, { replace: true });
      },
      back: () => window.history.back(),
      prefetch: () => {},
      refresh: () => window.location.reload(),
    }),
    [],
  );
}

export function useSearchParams() {
  const { query } = useHashLocation();
  return useMemo(() => new URLSearchParams(query), [query]);
}

export function usePathname() {
  return useHashLocation().path;
}
