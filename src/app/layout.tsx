import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { headers } from "next/headers";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { getMaintenanceStatus } from "@/lib/supabase-admin";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ACLiSS",
  description: "臨床検査情報提供システム（ACLiSS）",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ACLiSS",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#203863",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // メンテナンス中は閲覧側の画面を止める。ただし管理画面（/admin）は
  // メンテナンスを解除できるよう対象外にする。
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");

  let maintenance = { enabled: false, message: null as string | null };
  if (!isAdmin) {
    maintenance = await getMaintenanceStatus();
  }

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegister />
        <header className="bg-navy text-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <Link href="/" prefetch={false} className="text-xl font-bold tracking-wide">
              ACLiSS
            </Link>
            <span className="h-5 w-1 rounded bg-gold" aria-hidden="true" />
            <span className="text-sm text-white/80">
              臨床検査情報提供システム
            </span>
          </div>
        </header>
        <main className="flex-1">
          {maintenance.enabled ? (
            <MaintenanceScreen message={maintenance.message} />
          ) : (
            children
          )}
        </main>
      </body>
    </html>
  );
}
