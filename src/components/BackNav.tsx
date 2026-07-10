"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function BackNav() {
  const router = useRouter();

  return (
    <div className="mb-4 flex items-center gap-4 text-navy">
      <button type="button" onClick={() => router.back()} className="underline">
        ← 戻る
      </button>
      <Link href="/" prefetch={false} className="underline">
        ホーム
      </Link>
    </div>
  );
}
