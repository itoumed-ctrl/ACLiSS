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
await writeFile(path.join(out, "manifest.webmanifest"), await readApp("manifest.webmanifest"));
// 画面で使う画像（メニューのアイコン、ブラウザのタブ・ホーム画面のアイコン）。院内サーバー版だけの絵で、Vercel版の public/icons とは別
const appIcons = (await readdir(path.join(here, "icons"))).filter((f) => f.endsWith(".png"));
for (const icon of appIcons) {
  await cp(path.join(here, "icons", icon), path.join(out, "icons", icon));
}
await cp(zxingFile, path.join(out, "vendor/zxing-browser.min.js"));

// 利用の記録用の空の画像（1×1の透明なGIF）。アプリがこれを取りに行くと、Webサーバーのアクセスログに記録が残る
await writeFile(
  path.join(out, "log.gif"),
  Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
);

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
    "master/phonebook.csv": await readFile(path.join(sampleDir, "phonebook.csv"), "utf8"),
  };
  const images = Object.fromEntries(
    Object.entries(SAMPLE_PHOTOS).map(([code, photo]) => [
      code,
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawSamplePhoto(code, photo))}`,
    ]),
  );
  const inlineScript = (code) => `<script>${code.replace(/<\/(script)/gi, "<\\/$1")}</script>`;
  const assets = {};
  // プレビューで使うのは画面の中のアイコンだけ（タブ・ホーム画面のアイコンは埋め込まない）
  for (const icon of appIcons.filter((f) => f.startsWith("menu-"))) {
    const png = await readFile(path.join(here, "icons", icon));
    assets[`icons/${icon}`] = `data:image/png;base64,${png.toString("base64")}`;
  }
  const openingLogo = `data:image/png;base64,${(await readFile(path.join(here, "icons", "icon-512.png"))).toString("base64")}`;
  const previewData = JSON.stringify({ files, images, assets }).replace(/</g, "\\u003c");
  const scripts = [
    `window.__ACLISS_PREVIEW__ = ${previewData};`,
    await readFile(zxingFile, "utf8"),
    await readApp("app.js"),
  ];

  // 置き換える文字列に「$」が含まれていても崩れないよう、関数で置き換える
  const html = (await readApp("index.html"))
    .replace("<title>ACLiSS</title>", () => "<title>ACLiSS 院内版プレビュー</title>")
    .replace(/ *<link rel="(icon|apple-touch-icon|manifest)"[^>]*>\n/g, () => "")
    .replace(/src="icons\/icon-512\.png[^"]*"/, () => `src="${openingLogo}"`);
  const css = await readApp("app.css");
  const page = html
    .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}${PREVIEW_BAR_CSS}</style>`)
    .replace("<body>", () => `<body>\n    ${PREVIEW_BAR}`)
    // 本番では app.js を head に defer で置くが、埋め込む時はページの最後で動かす
    .replace(/\s*<!-- defer:[^>]*-->\s*<script src="app\.js[^"]*" defer><\/script>/, () => "")
    .replace("</body>", () => `${scripts.map(inlineScript).join("\n")}\n  </body>`);

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

// ログ集計ダッシュボードの確認用プレビュー。架空の1か月分のログを埋め込む（毎回同じ内容になるよう乱数は固定）
async function buildLogPreview() {
  const names = await readFile(path.join(here, "preview/containers.csv"), "utf8");
  const sample = JSON.stringify({ log: sampleLog(), names }).replace(/</g, "\\u003c");
  const page = (await readFile(path.join(here, "log-summary.html"), "utf8")).replace(
    "    <script>\n",
    () => `    <script>window.__ACLISS_LOG_SAMPLE__ = ${sample};</script>\n    <script>\n`,
  );
  await writeFile(path.join(root, "intranet-preview", "log-dashboard-preview.html"), page);
  console.log("intranet-preview/log-dashboard-preview.html を作成しました");
}

function sampleLog() {
  let seed = 20261020;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (weights) => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (const [k, w] of Object.entries(weights)) if ((r -= w) < 0) return k;
    return Object.keys(weights).at(-1);
  };
  // 採血の多い早朝と日中に山がある時間帯の重み（日本時間）
  const hours = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 6, 6: 14, 7: 10, 8: 6, 9: 12, 10: 12, 11: 9, 12: 4, 13: 9, 14: 10, 15: 9, 16: 6, 17: 4, 18: 3, 19: 4, 20: 5, 21: 3, 22: 2, 23: 1 };
  const codes = { "001": 30, "002": 25, "003": 12, "004": 10, "005": 9, "006": 6, "007": 5, "008": 3 };
  const via = { scan: 58, digits: 14, list: 10, search: 13, direct: 5 };
  const ua = "Mozilla/5.0+(Linux;+Android+14)+AppleWebKit/537.36+(KHTML,+like+Gecko)+Chrome/129.0+Mobile+Safari/537.36";
  const rows = [];
  const add = (jst, query) => {
    const utc = new Date(jst.getTime() - 9 * 3600e3).toISOString();
    const ip = `10.1.2.${10 + Math.floor(rand() * 50)}`;
    rows.push([utc, `${utc.slice(0, 10)} ${utc.slice(11, 19)} 10.1.0.5 GET /acliss/log.gif ${query} 443 - ${ip} ${ua} - 200 0 0 2`]);
  };
  for (let d = 0; d < 30; d++) {
    const day = new Date(Date.UTC(2026, 8, 21 + d));
    const weekend = [0, 6].includes(day.getUTCDay());
    const sessions = Math.round((weekend ? 9 : 24) * (0.8 + rand() * 0.4));
    for (let s = 0; s < sessions; s++) {
      const at = new Date(day.getTime() + Number(pick(hours)) * 3600e3 + Math.floor(rand() * 3600) * 1e3);
      add(at, `e=open&t=${at.getTime()}`);
      if (rand() < 0.04) add(new Date(at.getTime() + 2e3), `e=camera&reason=${pick({ denied: 3, nodevice: 1, https: 1 })}`);
      const views = 1 + Math.floor(rand() * 2.4);
      for (let v = 0; v < views; v++) {
        const t = new Date(at.getTime() + (v + 1) * 40e3);
        if (rand() < 0.03) add(t, `e=notfound&code=${pick({ 485: 3, "099": 1 })}&via=${pick({ scan: 2, search: 1 })}`);
        else add(t, `e=view&code=${pick(codes)}&via=${pick(via)}`);
      }
    }
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  const head = "#Software: Microsoft Internet Information Services 10.0\n#Version: 1.0\n#Fields: date time s-ip cs-method cs-uri-stem cs-uri-query s-port cs-username c-ip cs(User-Agent) cs(Referer) sc-status sc-substatus sc-win32-status time-taken\n";
  return head + rows.map((r) => r[1]).join("\n") + "\n";
}

if (process.argv.includes("--preview")) {
  await buildPreview();
  await buildLogPreview();
}
