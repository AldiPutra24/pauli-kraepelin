import type { Metadata } from "next";
import { ResultView } from "@/components/result-view";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Hasil Tes Pauli" };

export default function PauliResultRoute() {
  return (
    <>
      <SiteHeader current="pauli" />
      <ResultView kind="pauli" />
    </>
  );
}
