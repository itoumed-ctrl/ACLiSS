import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { getMaintenanceStatus } from "@/lib/supabase-admin";

// メンテナンス中の文言は管理画面からいつでも変更されるため、
// ビルド時に静的化・固定化されないよう、常にリクエストごとに取得する。
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const { message } = await getMaintenanceStatus();
  return <MaintenanceScreen message={message} />;
}
