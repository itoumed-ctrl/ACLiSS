import Link from "next/link";

const DEFAULT_MESSAGE = "ただいまメンテナンス中です。しばらくお待ちください。";

export function MaintenanceScreen({ message }: { message: string | null }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <div className="text-5xl" aria-hidden="true">
        🛠️
      </div>
      <h1 className="text-2xl font-bold text-navy">メンテナンス中</h1>
      <p className="whitespace-pre-wrap text-foreground/70">
        {message || DEFAULT_MESSAGE}
      </p>
      <Link
        href="/admin"
        prefetch={false}
        className="mt-6 text-sm text-foreground/50 underline"
      >
        管理者はこちら
      </Link>
    </div>
  );
}
