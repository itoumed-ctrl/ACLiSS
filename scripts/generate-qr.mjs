// ACLiSS 配布用QRコード生成スクリプト
//
// 使い方:
//   VIEWER_PASSCODE=xxxxx node scripts/generate-qr.mjs
//   （VIEWER_PASSCODEは .env.local に設定しているものと同じ値を指定する。
//    ポスター画像にパスワードが写り込むため、パスワードをスクリプトに
//    直接書き込まないようにしている）
//
// 出力先: qr-output/acliss-qr.png（QRコード単体。パスワードは写り込まないためGit管理してよい）
//         qr-output/acliss-poster.png（院内掲示・印刷用のポスター、ID/パスワード付き。
//         パスワードが写り込むため、このフォルダはGit管理対象外にしてある）
//
// URLが変わった場合（独自ドメイン取得時など）は、下の SITE_URL を書き換えて
// 再実行すれば新しいQRコード・ポスターが作り直せる。

import QRCode from "qrcode";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SITE_URL = "https://ac-li-ss.vercel.app";
const VIEWER_USER = "acliss";
const VIEWER_PASSCODE = process.env.VIEWER_PASSCODE;

if (!VIEWER_PASSCODE) {
  console.error(
    "エラー: 環境変数 VIEWER_PASSCODE が指定されていません。\n" +
      "例: VIEWER_PASSCODE=xxxxx node scripts/generate-qr.mjs",
  );
  process.exit(1);
}

const OUT_DIR = path.join(import.meta.dirname, "..", "qr-output");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const qrPngBuffer = await QRCode.toBuffer(SITE_URL, {
    type: "png",
    width: 600,
    margin: 2,
    color: { dark: "#203863", light: "#ffffff" },
  });

  await sharp(qrPngBuffer).toFile(path.join(OUT_DIR, "acliss-qr.png"));

  const posterWidth = 800;
  const posterHeight = 1100;
  const qrSize = 560;
  const qrX = (posterWidth - qrSize) / 2;
  const qrY = 260;

  const posterSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${posterWidth}" height="${posterHeight}">
      <rect width="${posterWidth}" height="${posterHeight}" fill="#ffffff"/>
      <rect width="${posterWidth}" height="170" fill="#203863"/>
      <text x="${posterWidth / 2}" y="90" font-family="Arial, Helvetica, sans-serif"
            font-weight="700" font-size="56" fill="#ffffff" text-anchor="middle">ACLiSS</text>
      <text x="${posterWidth / 2}" y="135" font-family="Arial, Helvetica, sans-serif"
            font-size="26" fill="#ffffff" text-anchor="middle">臨床検査情報提供システム</text>
      <rect x="${posterWidth / 2 - 40}" y="60" width="10" height="40" fill="#FFC000"/>

      <text x="${posterWidth / 2}" y="225" font-family="Arial, Helvetica, sans-serif"
            font-weight="700" font-size="34" fill="#203863" text-anchor="middle">スマホでスキャン</text>

      <rect x="${qrX - 20}" y="${qrY - 20}" width="${qrSize + 40}" height="${qrSize + 40}"
            fill="#ffffff" stroke="#203863" stroke-width="2"/>

      <text x="${posterWidth / 2}" y="${qrY + qrSize + 70}" font-family="Arial, Helvetica, sans-serif"
            font-size="24" fill="#203863" text-anchor="middle">${SITE_URL.replace("https://", "")}</text>

      <rect x="140" y="${qrY + qrSize + 110}" width="${posterWidth - 280}" height="120"
            rx="12" fill="#203863" opacity="0.06"/>
      <text x="${posterWidth / 2}" y="${qrY + qrSize + 155}" font-family="Arial, Helvetica, sans-serif"
            font-weight="700" font-size="26" fill="#203863" text-anchor="middle">ログイン情報</text>
      <text x="${posterWidth / 2}" y="${qrY + qrSize + 195}" font-family="Arial, Helvetica, sans-serif"
            font-size="24" fill="#203863" text-anchor="middle">ID: ${VIEWER_USER}　パスワード: ${VIEWER_PASSCODE}</text>

      <text x="${posterWidth / 2}" y="${posterHeight - 30}" font-family="Arial, Helvetica, sans-serif"
            font-size="18" fill="#b91c1c" text-anchor="middle">院内掲示専用です。SNS等には掲載しないでください。</text>
    </svg>
  `;

  await sharp(Buffer.from(posterSvg))
    .composite([{ input: qrPngBuffer, left: Math.round(qrX), top: Math.round(qrY) }])
    .png()
    .toFile(path.join(OUT_DIR, "acliss-poster.png"));

  console.log("生成しました:");
  console.log(" - qr-output/acliss-qr.png");
  console.log(" - qr-output/acliss-poster.png（Git管理対象外）");
}

main();
