// 院内サーバー版のビルド。npm run build:intranet で intranet-dist/ に
// 「そのまま院内サーバーへコピーすればよいフォルダ」を作る。
// アプリ本体（index.html・app.js・app.css）は手書きのファイルをそのまま並べるだけで、変換はしない。
// 外部のサーバー（Vercel・Supabase・CDN・Googleフォント）には一切つながらない。
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const here = path.join(root, "intranet");
const out = path.join(root, "intranet-dist");
const buildId = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

// iPhoneなどブラウザ内蔵のバーコード読み取りがない端末で使う読み取り部品
const zxingFile = path.join(root, "node_modules/@zxing/browser/umd/zxing-browser.min.js");

// 端末に古いファイルが残らないよう、読み込むURLにビルドごとの番号を付ける
async function readApp(file) {
  return (await readFile(path.join(here, file), "utf8")).replaceAll("__BUILD_ID__", buildId);
}

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "icons"), { recursive: true });
await mkdir(path.join(out, "vendor"), { recursive: true });

for (const file of ["index.html", "app.js", "app.css"]) {
  await writeFile(path.join(out, file), await readApp(file));
}
await cp(path.join(here, "manifest.webmanifest"), path.join(out, "manifest.webmanifest"));
for (const icon of ["icon-192.png", "icon-512.png", "apple-touch-icon.png"]) {
  await cp(path.join(root, "public/icons", icon), path.join(out, "icons", icon));
}
// 画面で使う画像（メニューのアイコンなど）
const appIcons = (await readdir(path.join(here, "icons"))).filter((f) => f.endsWith(".png"));
for (const icon of appIcons) {
  await cp(path.join(here, "icons", icon), path.join(out, "icons", icon));
}
await cp(zxingFile, path.join(out, "vendor/zxing-browser.min.js"));

// マスタCSVと写真は院内で別管理するため、置き場所と説明だけを用意しておく。
await mkdir(path.join(out, "master"), { recursive: true });
await mkdir(path.join(out, "images"), { recursive: true });
await cp(path.join(here, "placeholders/master-README.txt"), path.join(out, "master/README.txt"));
await cp(path.join(here, "placeholders/images-README.txt"), path.join(out, "images/README.txt"));

console.log(`intranet-dist/ を作成しました（ビルド ${buildId}）`);

// 開発中に画面を確認するための1ファイル版。index.html に、CSS・JavaScript・サンプルのCSVと
// 仮の写真を埋め込み、サーバーに置かなくても開くだけで動くようにする。院内サーバーに置くものではない。
async function buildPreview() {
  const sampleDir = path.join(here, "preview");
  const files = {
    "master/containers.csv": await readFile(path.join(sampleDir, "containers.csv"), "utf8"),
    "master/test_items.csv": await readFile(path.join(sampleDir, "test_items.csv"), "utf8"),
  };
  const images = Object.fromEntries(
    Object.entries(SAMPLE_PHOTOS).map(([code, photo]) => [
      code,
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawSamplePhoto(code, photo))}`,
    ]),
  );
  const inlineScript = (code) => `<script>${code.replace(/<\/(script)/gi, "<\\/$1")}</script>`;
  const assets = {};
  for (const icon of appIcons) {
    const png = await readFile(path.join(here, "icons", icon));
    assets[`icons/${icon}`] = `data:image/png;base64,${png.toString("base64")}`;
  }
  const previewData = JSON.stringify({ files, images, assets }).replace(/</g, "\\u003c");
  const scripts = [
    `window.__ACLISS_PREVIEW__ = ${previewData};`,
    await readFile(zxingFile, "utf8"),
    await readApp("app.js"),
  ];

  // 置き換える文字列に「$」が含まれていても崩れないよう、関数で置き換える
  let indexHtml = await readApp("index.html");
  for (const [file, dataUri] of Object.entries(assets)) {
    indexHtml = indexHtml.replaceAll(`${file}?v=${buildId}`, () => dataUri);
  }
  const html = indexHtml
    .replace("<title>ACLiSS</title>", () => "<title>ACLiSS 院内版プレビュー</title>")
    .replace(/ *<link rel="(icon|apple-touch-icon|manifest)"[^>]*>\n/g, () => "");
  const css = await readApp("app.css");
  const page = html
    .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}${PREVIEW_BAR_CSS}</style>`)
    .replace("<body>", () => `<body>\n    ${PREVIEW_BAR}`)
    .replace(/<script src="app\.js[^"]*"><\/script>/, () => scripts.map(inlineScript).join("\n"));

  const previewDir = path.join(root, "intranet-preview");
  await mkdir(previewDir, { recursive: true });
  await writeFile(path.join(previewDir, "acliss-preview.html"), page);
  console.log("intranet-preview/acliss-preview.html を作成しました");
}

const PREVIEW_BAR_CSS = `
.preview-bar { background: #ffc000; color: #203863; font-size: 12px; font-weight: 600; padding: 6px 16px; text-align: center; }`;
const PREVIEW_BAR = `<div class="preview-bar">開発用プレビュー：サンプルデータで表示しています。カメラはこの画面では使えません（ラベル数字の手入力は使えます）</div>`;

const SAMPLE_PHOTOS = {
  "001": { kind: "tube", cap: "#7a4a25" },
  "002": { kind: "tube", cap: "#7b3fa0" },
  "003": { kind: "tube", cap: "#26282d" },
  "004": { kind: "tube", cap: "#8a8f98" },
  "005": { kind: "cup", cap: "#e8b400" },
  "006": { kind: "bottle", cap: "#2f6fb5" },
};

function drawSamplePhoto(code, { kind, cap }) {
  const shapes = {
    tube: `<rect x="200" y="40" width="80" height="46" rx="8" fill="${cap}"/>
      <rect x="208" y="86" width="64" height="190" rx="30" fill="#fff" stroke="#9aa3b5" stroke-width="3"/>
      <rect x="212" y="186" width="56" height="86" rx="26" fill="#a3222a"/>
      <rect x="214" y="112" width="52" height="58" fill="#e9eef7" stroke="#c5ccda"/>`,
    cup: `<path d="M170 90 H310 L292 272 H188 Z" fill="#fff" stroke="#9aa3b5" stroke-width="3"/>
      <rect x="160" y="70" width="160" height="26" rx="6" fill="${cap}"/>
      <path d="M182 180 H298 L292 268 H188 Z" fill="#f2d65a"/>`,
    bottle: `<rect x="218" y="40" width="44" height="34" rx="6" fill="${cap}"/>
      <rect x="226" y="74" width="28" height="30" fill="#dfe4ee" stroke="#9aa3b5" stroke-width="2"/>
      <rect x="180" y="104" width="120" height="172" rx="22" fill="#fff" stroke="#9aa3b5" stroke-width="3"/>
      <rect x="192" y="150" width="96" height="70" fill="#e9eef7" stroke="#c5ccda"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#f4f6fa"/>${shapes[kind]}
    <text x="240" y="306" font-size="16" text-anchor="middle" fill="#5d6779" font-family="sans-serif">サンプル写真 ${code}</text>
  </svg>`;
}

if (process.argv.includes("--preview")) {
  await buildPreview();
}
