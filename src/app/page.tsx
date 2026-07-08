import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-navy">容器を調べる</h1>

      <HomeButton
        href="/scan"
        title="バーコードをスキャン"
        description="スマホのカメラでバーコードを読み取ります"
      />
      <HomeButton
        href="/containers"
        title="容器一覧から選ぶ"
        description="容器コードや種類から探します"
      />
      <HomeButton
        href="/search"
        title="検査項目から探す"
        description="検査項目名で検索します"
      />

      <Link
        href="/admin"
        className="mt-6 self-center text-sm text-foreground/50 underline"
      >
        管理者はこちら
      </Link>
    </div>
  );
}

function HomeButton({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-lg border-2 border-navy/20 bg-white px-5 py-5 active:bg-navy/5"
    >
      <span className="text-xl font-bold text-navy">{title}</span>
      <span className="text-sm text-foreground/70">{description}</span>
    </Link>
  );
}
