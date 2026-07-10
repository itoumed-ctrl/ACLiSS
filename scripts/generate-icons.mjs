// ACLiSS PWAアイコン・favicon生成スクリプト。
// ロゴ（対角線の試験管 + "ACLiSS"ワードマーク、金色のiの旗飾り）を元に
// 各サイズのPNG/ICO/SVGを書き出す。
// 実行: node scripts/generate-icons.mjs
import sharp from "sharp";
import toIco from "to-ico";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// 元デザインは600x600のキャンバスを基準に作成している。
const NATURAL_SIZE = 600;

function squareIconSvg({ size, padding }) {
  const scale = (size - padding * 2) / NATURAL_SIZE;
  const offset = (size - NATURAL_SIZE * scale) / 2;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <g transform="translate(${offset},${offset}) scale(${scale})">
    <g transform="rotate(-45 300 300)">
      <clipPath id="tc"><path d="M 255 20 L 255 480 A 45 45 0 0 0 345 480 L 345 20 Z"/></clipPath>
      <rect x="245" y="330" width="110" height="180" fill="#FBF0CE" clip-path="url(#tc)"/>
      <g clip-path="url(#tc)">
        <circle cx="285" cy="360" r="6" fill="#ffffff"/>
        <circle cx="315" cy="380" r="4" fill="#ffffff"/>
        <circle cx="295" cy="405" r="7" fill="#ffffff"/>
        <circle cx="285" cy="120" r="5" fill="#e9edf2"/>
        <circle cx="310" cy="150" r="3" fill="#e9edf2"/>
        <circle cx="295" cy="200" r="4" fill="#e9edf2"/>
      </g>
      <path d="M 255 20 L 255 480 A 45 45 0 0 0 345 480 L 345 20"
            fill="none" stroke="#C6D0DC" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="40" y="345" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="115" fill="#1F3864" letter-spacing="-3">ACL</text>
    <rect x="308" y="278" width="17" height="67" rx="7" fill="#1F3864"/>
    <path d="M 325 236 L 370 236 L 370 247 L 345 258 L 370 269 L 370 280 L 325 280 Z" fill="#FFC000"/>
    <text x="340" y="345" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="115" fill="#1F3864" letter-spacing="-3">SS</text>
  </g>
</svg>`;
}

const iconsDir = path.join(process.cwd(), "public", "icons");
await mkdir(iconsDir, { recursive: true });

await sharp(Buffer.from(squareIconSvg({ size: 192, padding: 14 })))
  .png()
  .toFile(path.join(iconsDir, "icon-192.png"));

await sharp(Buffer.from(squareIconSvg({ size: 512, padding: 36 })))
  .png()
  .toFile(path.join(iconsDir, "icon-512.png"));

// maskableはOSにより円形等でトリミングされるため、安全マージンを広めに取る
await sharp(Buffer.from(squareIconSvg({ size: 512, padding: 90 })))
  .png()
  .toFile(path.join(iconsDir, "icon-512-maskable.png"));

await sharp(Buffer.from(squareIconSvg({ size: 180, padding: 14 })))
  .png()
  .toFile(path.join(iconsDir, "apple-touch-icon.png"));

// favicon.ico（16/32/48pxを1つのICOにまとめる）
const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(
  faviconSizes.map((size) =>
    sharp(Buffer.from(squareIconSvg({ size, padding: Math.round(size * 0.06) })))
      .png()
      .toBuffer(),
  ),
);
const icoBuffer = await toIco(faviconPngs);
await writeFile(path.join(process.cwd(), "src", "app", "favicon.ico"), icoBuffer);

// icon.svg（モダンブラウザ向け、Next.jsのiconファイル規約）
await writeFile(
  path.join(process.cwd(), "src", "app", "icon.svg"),
  squareIconSvg({ size: 64, padding: 4 }),
);

console.log("アイコンを生成しました: public/icons/*, src/app/favicon.ico, src/app/icon.svg");
