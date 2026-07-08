export default function Home() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-navy">
        ACLiSS プロジェクト雛形（フェーズ0）
      </h1>
      <p className="text-base leading-relaxed">
        このページが表示されていれば、Next.js + TypeScript + Tailwind CSS の雛形が
        正しく動作しています。ここから容器一覧・バーコードスキャン・検査項目検索などの
        画面を段階的に追加していきます。
      </p>
      <div className="rounded-lg border border-navy/20 bg-navy/5 p-4">
        <p className="font-semibold text-navy">次のステップ</p>
        <p className="text-sm text-foreground/80">
          Supabase接続やマスタデータの取り込みは、この雛形の動作確認後に進めます。
        </p>
      </div>
    </div>
  );
}
