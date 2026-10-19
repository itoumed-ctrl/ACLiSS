// 院内サーバー版のビルド。npm run build:intranet で intranet-dist/ に
// 「そのまま院内サーバーへコピーすればよいフォルダ」を作る。
// 外部のサーバー（Vercel・Supabase・CDN・Googleフォント）には一切つながらない。
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

process.env.NODE_ENV = "production";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const here = path.join(root, "intranet");
const out = path.join(root, "intranet-dist");
const buildId = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

// 本体（Next.js版）の画面部品をそのまま使うため、Next.js専用の部品と
// データの取得元（Supabase）だけを院内版のものに差し替える。
const replacements = {
  "next/link": path.join(here, "src/shims/next-link.tsx"),
  "next/navigation": path.join(here, "src/shims/next-navigation.ts"),
  "@/lib/useMasterData": path.join(here, "src/useMasterDataCsv.ts"),
};

const replacePlugin = {
  name: "acliss-intranet-replacements",
  setup(build) {
    build.onResolve({ filter: /^(next\/link|next\/navigation|@\/lib\/useMasterData)$/ }, (args) => ({
      path: replacements[args.path],
    }));
  },
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(here, "src/main.tsx")],
  outfile: path.join(out, "app.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020", "safari15"],
  jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  plugins: [replacePlugin],
  logLevel: "warning",
});

const cssSource = path.join(here, "styles.css");
const css = await postcss([tailwind({ base: root, optimize: true })]).process(
  await readFile(cssSource, "utf8"),
  { from: cssSource },
);
await writeFile(path.join(out, "app.css"), css.css);

await mkdir(path.join(out, "icons"), { recursive: true });
for (const icon of ["icon-192.png", "icon-512.png", "apple-touch-icon.png"]) {
  await cp(path.join(root, "public/icons", icon), path.join(out, "icons", icon));
}

const html = (await readFile(path.join(here, "index.html"), "utf8")).replaceAll(
  "__BUILD_ID__",
  buildId,
);
await writeFile(path.join(out, "index.html"), html);
await cp(path.join(here, "manifest.webmanifest"), path.join(out, "manifest.webmanifest"));

// マスタCSVと写真は院内で別管理するため、置き場所と説明だけを用意しておく。
await mkdir(path.join(out, "master"), { recursive: true });
await mkdir(path.join(out, "images"), { recursive: true });
await cp(path.join(here, "placeholders/master-README.txt"), path.join(out, "master/README.txt"));
await cp(path.join(here, "placeholders/images-README.txt"), path.join(out, "images/README.txt"));

console.log(`intranet-dist/ を作成しました（ビルド ${buildId}）`);

// 開発中に画面を確認するための1ファイル版。サンプルのCSVと仮の写真を埋め込み、
// サーバーに置かなくても開くだけで動く。院内サーバーに置くものではない。
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
  const previewData = JSON.stringify({ files, images }).replace(/</g, "\\u003c");
  const appJs = (await readFile(path.join(out, "app.js"), "utf8")).replace(
    /<\/(script)/gi,
    "<\\/$1",
  );
  const appCss = await readFile(path.join(out, "app.css"), "utf8");

  const html = `<title>ACLiSS 院内版プレビュー</title>
<style>${appCss}</style>
<style>
.acliss-preview-bar { background: #ffc000; color: #203863; font: 600 12px/1.5 -apple-system, "Hiragino Sans", "Yu Gothic UI", sans-serif; padding: 6px 16px; text-align: center; }
</style>
<div class="acliss-preview-bar">開発用プレビュー：サンプルデータで表示しています。カメラはこの画面では使えません（ラベル数字の手入力は使えます）</div>
<div id="root" class="flex min-h-screen flex-col"></div>
<script>window.__ACLISS_PREVIEW__ = ${previewData};</script>
<script>${appJs}</script>
`;
  const previewDir = path.join(root, "intranet-preview");
  await mkdir(previewDir, { recursive: true });
  await writeFile(path.join(previewDir, "acliss-preview.html"), html);
  console.log("intranet-preview/acliss-preview.html を作成しました");
}

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
