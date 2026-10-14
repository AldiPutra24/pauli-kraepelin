import type { Metadata } from "next";
import { TestRunner } from "@/components/test-runner";

export const metadata: Metadata = { title: "Tes Kraepelin berlangsung" };

export default function KraepelinTestRoute() {
  return <TestRunner kind="kraepelin" />;
}
