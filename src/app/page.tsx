import Link from "next/link";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-navy">容器を調べる</h1>
        <BarcodeScanner />
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
      </section>

      <section className="flex flex-col gap-4 border-t border-navy/10 pt-6">
        <h2 className="text-2xl font-bold text-navy">検査を調べる</h2>
        <HomeButton
          href="/blood-volume"
          title="最低採血量を計算する"
          description="検査項目を選ぶと必要な採血量が分かります"
        />
      </section>

      <Link
        href="/admin"
        prefetch={false}
        className="self-center text-sm text-foreground/50 underline"
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
      prefetch={false}
      className="flex flex-col gap-1 rounded-lg border-2 border-navy/20 bg-white px-5 py-5 active:bg-navy/5"
    >
      <span className="text-xl font-bold text-navy">{title}</span>
      <span className="text-sm text-foreground/70">{description}</span>
    </Link>
  );
}
