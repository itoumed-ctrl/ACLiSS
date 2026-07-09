import type { Container } from "@/lib/types";
import { containerLabel } from "@/lib/containerLabel";

export function ContainerDetail({ container }: { container: Container }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-navy">{container.container_code}</h1>
        {(container.vessel || container.material) && (
          <p className="text-xl text-foreground/80">{containerLabel(container)}</p>
        )}
      </div>

      {container.image_url && (
        // 容器写真。院内共有フォルダの画像パスはそのまま使えないため、
        // Supabaseストレージに移行済みの image_url のみ表示する。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={container.image_url}
          alt={`容器コード${container.container_code}の写真`}
          className="max-h-80 w-full rounded-lg border border-navy/20 object-contain bg-white"
        />
      )}

      <DetailRow label="採取量" value={container.collection_amount ?? "規定なし"} emphasize />

      <DetailRow
        label="払い出し場所"
        value={
          container.dispense_location
            ? `${container.dispense_location}${
                container.dispense_phs ? `（内線: ${container.dispense_phs}）` : ""
              }`
            : "未設定"
        }
        emphasize
      />

      {container.test_summary && (
        <DetailRow label="検査項目" value={container.test_summary} />
      )}

      {container.has_instruction && (
        <div className="rounded-lg border-2 border-gold bg-gold/10 p-4">
          <p className="mb-2 font-bold text-navy">採取指示</p>
          <ul className="list-disc space-y-1 pl-5 text-lg">
            {[container.instruction_1, container.instruction_2, container.instruction_3]
              .filter(Boolean)
              .map((instruction, i) => (
                <li key={i}>{instruction}</li>
              ))}
          </ul>
        </div>
      )}

      {container.notes && (
        <div className="rounded-lg border border-navy/20 bg-navy/5 p-4">
          <p className="mb-1 font-bold text-navy">注意事項</p>
          <p className="whitespace-pre-wrap text-lg">{container.notes}</p>
        </div>
      )}

      {(container.inquiry_dept || container.inquiry_phs) && (
        <DetailRow
          label="検査問い合わせ先"
          value={`${container.inquiry_dept ?? ""}${
            container.inquiry_phs ? `（内線: ${container.inquiry_phs}）` : ""
          }`}
        />
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-navy/70">{label}</p>
      <p className={emphasize ? "text-2xl font-bold" : "text-lg"}>{value}</p>
    </div>
  );
}
