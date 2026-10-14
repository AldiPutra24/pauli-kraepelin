import type { Metadata } from "next";
import { SetupPage } from "@/components/setup-page";

export const metadata: Metadata = { title: "Tes Kraepelin" };

export default function KraepelinSetupRoute() {
  return <SetupPage kind="kraepelin" />;
}
