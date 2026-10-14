import type { Metadata } from "next";
import { TestRunner } from "@/components/test-runner";

export const metadata: Metadata = { title: "Tes Pauli berlangsung" };

export default function PauliTestRoute() {
  return <TestRunner kind="pauli" />;
}
