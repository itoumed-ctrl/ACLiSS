import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  description: "臨床検査容器情報 即時参照システム（ACLiSS）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="bg-navy text-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <span className="text-xl font-bold tracking-wide">ACLiSS</span>
            <span className="h-5 w-1 rounded bg-gold" aria-hidden="true" />
            <span className="text-sm text-white/80">
              臨床検査容器情報 即時参照システム
            </span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
