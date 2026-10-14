import type { Metadata } from "next";
import { ResultView } from "@/components/result-view";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Hasil Tes Kraepelin" };

export default function KraepelinResultRoute() {
  return (
    <>
      <SiteHeader current="kraepelin" />
      <ResultView kind="kraepelin" />
    </>
  );
}
