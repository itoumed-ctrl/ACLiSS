import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ACLiSS 臨床検査情報提供システム",
    short_name: "ACLiSS",
    description: "採血・採取時に容器情報を即時参照できるシステム",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#203863",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
