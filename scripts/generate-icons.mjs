// ACLiSS PWAアイコン・favicon生成スクリプト。
// ロゴマーク（試験管の"A"）を元に各サイズのPNG/ICO/SVGを書き出す。
// 実行: node scripts/generate-icons.mjs
import sharp from "sharp";
import toIco from "to-ico";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const NAVY = "#203863";
const GOLD = "#FFC000";

function markSvg({ size, padding, background }) {
  // 元のロゴマーク（試験管+"A"の脚）を正方形キャンバスの中央に配置する。
  // 自然な図形の外接矩形はおよそ x:[0,232] y:[8,300]（縦292 x 横232）。
  const naturalWidth = 232;
  const naturalHeight = 292;
  const naturalTop = 8;
  const available = size - padding * 2;
  const scale = Math.min(available / naturalWidth, available / naturalHeight);
  const scaledWidth = naturalWidth * scale;
  const scaledHeight = naturalHeight * scale;
  const offsetX = (size - scaledWidth) / 2;
  const offsetY = (size - scaledHeight) / 2;

  const bg = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : "";

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${bg}
  <g transform="translate(${offsetX},${offsetY}) scale(${scale}) translate(0,${-naturalTop})">
    <path d="M 0 300 L 128 8 L 138 8 L 72 300 Z" fill="#ffffff"/>
    <clipPath id="tc"><path d="M 128 8 L 128 235 A 52 52 0 0 0 232 235 L 232 8 Z"/></clipPath>
    <rect x="118" y="130" width="124" height="180" fill="${GOLD}" clip-path="url(#tc)"/>
    <g clip-path="url(#tc)">
      <circle cx="160" cy="155" r="7" fill="${NAVY}"/>
      <circle cx="195" cy="180" r="5" fill="${NAVY}"/>
      <circle cx="170" cy="205" r="9" fill="${NAVY}"/>
      <circle cx="205" cy="150" r="4" fill="${NAVY}"/>
      <circle cx="150" cy="190" r="4" fill="${NAVY}"/>
    </g>
    <g clip-path="url(#tc)">
      <circle cx="158" cy="80" r="6" fill="${GOLD}"/>
      <circle cx="182" cy="98" r="4" fill="${GOLD}"/>
      <circle cx="164" cy="112" r="3" fill="${GOLD}"/>
    </g>
    <path d="M 128 8 L 128 235 A 52 52 0 0 0 232 235 L 232 8"
          fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="128" y="42" width="104" height="11" fill="#ffffff"/>
  </g>
</svg>`;
}

const iconsDir = path.join(process.cwd(), "public", "icons");
await mkdir(iconsDir, { recursive: true });

// 通常アイコン（余白少なめ）
await sharp(Buffer.from(markSvg({ size: 192, padding: 24, background: NAVY })))
  .png()
  .toFile(path.join(iconsDir, "icon-192.png"));

await sharp(Buffer.from(markSvg({ size: 512, padding: 64, background: NAVY })))
  .png()
  .toFile(path.join(iconsDir, "icon-512.png"));

// maskableはOSにより円形等でトリミングされるため、安全マージンを広めに取る
await sharp(Buffer.from(markSvg({ size: 512, padding: 110, background: NAVY })))
  .png()
  .toFile(path.join(iconsDir, "icon-512-maskable.png"));

await sharp(Buffer.from(markSvg({ size: 180, padding: 24, background: NAVY })))
  .png()
  .toFile(path.join(iconsDir, "apple-touch-icon.png"));

// favicon.ico（16/32/48pxを1つのICOにまとめる）
const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(
  faviconSizes.map((size) =>
    sharp(Buffer.from(markSvg({ size, padding: Math.round(size * 0.1), background: NAVY })))
      .png()
      .toBuffer(),
  ),
);
const icoBuffer = await toIco(faviconPngs);
await writeFile(path.join(process.cwd(), "src", "app", "favicon.ico"), icoBuffer);

// icon.svg（モダンブラウザ向け、Next.jsのiconファイル規約）
await writeFile(
  path.join(process.cwd(), "src", "app", "icon.svg"),
  markSvg({ size: 64, padding: 6, background: NAVY }),
);

console.log("アイコンを生成しました: public/icons/*, src/app/favicon.ico, src/app/icon.svg");
