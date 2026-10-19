import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import ContainersListPage from "@/app/containers/page";
import TestItemSearchPage from "@/app/search/page";
import ScanPage from "@/app/scan/page";
import { BackNav } from "@/components/BackNav";
import { ContainerDetailRoute } from "./ContainerDetailRoute";
import { Home } from "./Home";
import { toHref, useHashLocation } from "./router";

function CurrentPage({ path }: { path: string }) {
  if (path === "/") return <Home />;
  if (path === "/scan") return <ScanPage />;
  if (path === "/containers") return <ContainersListPage />;
  if (path === "/search") return <TestItemSearchPage />;

  const detail = path.match(/^\/containers\/([^/]+)$/);
  if (detail) return <ContainerDetailRoute code={decodeURIComponent(detail[1])} />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BackNav />
      <p>ページが見つかりません。</p>
    </div>
  );
}

function App() {
  const { path } = useHashLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <>
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href={toHref("/")} className="text-xl font-bold tracking-wide">
            ACLiSS
          </a>
          <span className="h-5 w-1 rounded bg-gold" aria-hidden="true" />
          <span className="text-sm text-white/80">臨床検査情報提供システム</span>
        </div>
      </header>
      {/* 画面ごとに作り直し、トップを離れたらカメラも確実に止まるようにする */}
      <main key={path} className="flex-1">
        <CurrentPage path={path} />
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
