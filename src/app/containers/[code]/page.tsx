import { getSupabaseClient } from "@/lib/supabase";
import type { Container } from "@/lib/types";
import { ContainerDetail } from "@/components/ContainerDetail";
import { BackNav } from "@/components/BackNav";

export default async function ContainerDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  let container: Container | null = null;
  let errorMessage: string | null = null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("containers")
      .select("*")
      .eq("container_code", code)
      .maybeSingle();

    if (error) {
      errorMessage = error.message;
    } else {
      container = data as Container | null;
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "エラーが発生しました";
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BackNav />

      {errorMessage && (
        <p className="rounded-lg bg-red-50 p-4 text-red-700">
          エラー: {errorMessage}
        </p>
      )}

      {!errorMessage && !container && (
        <p className="rounded-lg bg-red-50 p-4 text-red-700">
          容器コード「{code}」は見つかりませんでした。
        </p>
      )}

      {container && <ContainerDetail container={container} />}
    </div>
  );
}
