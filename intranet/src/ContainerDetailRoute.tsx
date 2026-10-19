import { BackNav } from "@/components/BackNav";
import { ContainerDetail } from "@/components/ContainerDetail";
import { useMasterData } from "./useMasterDataCsv";

// 本体ではサーバー側でデータベースから1件取得していたが、院内版は読み込み済みのCSVから探す。
export function ContainerDetailRoute({ code }: { code: string }) {
  const { containers, loading, error } = useMasterData();
  const container = containers.find((c) => c.container_code === code);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BackNav />

      {!container && loading && <p>読み込み中...</p>}

      {!container && !loading && error && (
        <p className="rounded-lg bg-red-50 p-4 text-red-700">エラー: {error}</p>
      )}

      {!container && !loading && !error && (
        <p className="rounded-lg bg-red-50 p-4 text-red-700">
          容器コード「{code}」は見つかりませんでした。
        </p>
      )}

      {container && <ContainerDetail container={container} />}
    </div>
  );
}
