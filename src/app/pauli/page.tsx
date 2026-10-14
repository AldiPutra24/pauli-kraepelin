import type { Metadata } from "next";
import { SetupPage } from "@/components/setup-page";

export const metadata: Metadata = { title: "Tes Pauli" };

export default function PauliSetupRoute() {
  return <SetupPage kind="pauli" />;
}
