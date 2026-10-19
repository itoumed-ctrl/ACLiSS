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
