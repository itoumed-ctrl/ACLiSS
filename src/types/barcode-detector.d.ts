// TypeScriptの標準DOM型にはまだ含まれていない Barcode Detection API の最小限の型定義。
// Android Chrome等、対応ブラウザでのみ実行時に存在する（"BarcodeDetector" in window で判定）。
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorOptions {
  formats?: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(image: CanvasImageSource): Promise<DetectedBarcode[]>;
}
