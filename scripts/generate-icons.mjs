// ACLiSS PWAアイコン・favicon生成スクリプト。
// 依頼者から渡された正式ロゴ画像（assets/acliss-logo.png、1134x1134の正方形PNG）を
// そのまま元に、各サイズのPNG/ICOを書き出す。
// 実行: node scripts/generate-icons.mjs
import sharp from "sharp";
import toIco from "to-ico";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SOURCE = path.join(process.cwd(), "assets", "acliss-logo.png");

async function resizeWithPadding(size, paddingRatio) {
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const resized = await sharp(SOURCE).resize(inner, inner).toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

const iconsDir = path.join(process.cwd(), "public", "icons");
await mkdir(iconsDir, { recursive: true });

await writeFile(path.join(iconsDir, "icon-192.png"), await resizeWithPadding(192, 0.04));
await writeFile(path.join(iconsDir, "icon-512.png"), await resizeWithPadding(512, 0.04));
// maskableはOSにより円形等でトリミングされるため、安全マージンを広めに取る
await writeFile(path.join(iconsDir, "icon-512-maskable.png"), await resizeWithPadding(512, 0.16));
await writeFile(path.join(iconsDir, "apple-touch-icon.png"), await resizeWithPadding(180, 0.04));

// favicon.ico（16/32/48pxを1つのICOにまとめる）
const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(faviconSizes.map((size) => resizeWithPadding(size, 0.02)));
const icoBuffer = await toIco(faviconPngs);
await writeFile(path.join(process.cwd(), "src", "app", "favicon.ico"), icoBuffer);

// icon.png（モダンブラウザ向け、Next.jsのiconファイル規約）
await writeFile(path.join(process.cwd(), "src", "app", "icon.png"), await resizeWithPadding(64, 0.02));

console.log("アイコンを生成しました: public/icons/*, src/app/favicon.ico, src/app/icon.png");
