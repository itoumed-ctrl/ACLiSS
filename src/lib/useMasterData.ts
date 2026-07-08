"use client";

import { useEffect, useState } from "react";
import type { Container, TestItem } from "./types";

const CONTAINERS_CACHE_KEY = "acliss-cache-containers";
const TEST_ITEMS_CACHE_KEY = "acliss-cache-test-items";
const UPDATED_AT_CACHE_KEY = "acliss-cache-updated-at";

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * 起動時に容器一覧・検査項目一覧をまとめて取得し、localStorageにもキャッシュする。
 * 通信に失敗した場合は、直近のキャッシュがあればそれを使い、
 * 最終更新日時（updatedAt）を画面側で表示できるようにする。
 */
export function useMasterData() {
  const [containers, setContainers] = useState<Container[]>(
    () => readCache<Container[]>(CONTAINERS_CACHE_KEY) ?? [],
  );
  const [testItems, setTestItems] = useState<TestItem[]>(
    () => readCache<TestItem[]>(TEST_ITEMS_CACHE_KEY) ?? [],
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(() =>
    readCache<string>(UPDATED_AT_CACHE_KEY),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [containersRes, testItemsRes] = await Promise.all([
          fetch("/api/containers"),
          fetch("/api/test-items"),
        ]);
        const containersJson = await containersRes.json();
        const testItemsJson = await testItemsRes.json();

        if (!containersRes.ok || !testItemsRes.ok) {
          throw new Error(containersJson.error ?? testItemsJson.error ?? "取得に失敗しました");
        }
        if (cancelled) return;

        setContainers(containersJson);
        setTestItems(testItemsJson);
        const now = new Date().toISOString();
        setUpdatedAt(now);
        setIsOffline(false);
        writeCache(CONTAINERS_CACHE_KEY, containersJson);
        writeCache(TEST_ITEMS_CACHE_KEY, testItemsJson);
        writeCache(UPDATED_AT_CACHE_KEY, now);
      } catch (e) {
        if (cancelled) return;
        setIsOffline(true);
        setError(e instanceof Error ? e.message : "取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { containers, testItems, updatedAt, loading, error, isOffline };
}
