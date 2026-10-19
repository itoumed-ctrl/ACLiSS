import type { AnchorHTMLAttributes } from "react";
import { toHref } from "../router";

// 本体（Next.js版）の画面部品をそのまま使うため、next/link の代わりに差し込む。
type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  prefetch?: boolean;
};

export default function Link({ href, prefetch, ...rest }: LinkProps) {
  void prefetch;
  return <a href={toHref(href)} {...rest} />;
}
