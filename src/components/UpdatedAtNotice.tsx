export function UpdatedAtNotice({
  updatedAt,
  isOffline,
}: {
  updatedAt: string | null;
  isOffline: boolean;
}) {
  if (!updatedAt) return null;

  const formatted = new Date(updatedAt).toLocaleString("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <p className="mb-4 text-xs text-foreground/60">
      {isOffline
        ? `オフラインのため前回のデータを表示中（最終更新: ${formatted}）`
        : `最終更新: ${formatted}`}
    </p>
  );
}
