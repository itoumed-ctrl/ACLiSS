import type { Container } from "./types";

/** 一覧・検索画面で表示する容器名（VESSEL・MATERIAL併記）。 */
export function containerLabel(c: Pick<Container, "vessel" | "material">): string {
  return [c.vessel, c.material].filter(Boolean).join(" － ");
}
