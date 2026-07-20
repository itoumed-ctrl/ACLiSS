import { BackNav } from "@/components/BackNav";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BackNav />
      <h1 className="mb-4 text-2xl font-bold text-navy">バーコードをスキャン</h1>
      <BarcodeScanner />
    </div>
  );
}
