import type { TestKind } from "./types";

export interface TestMeta {
  kind: TestKind;
  name: string;
  setupPath: `/${TestKind}`;
  testPath: `/${TestKind}/test`;
  resultPath: `/${TestKind}/result`;
  directionLabel: string;
}

export const TEST_META: Record<TestKind, TestMeta> = {
  pauli: {
    kind: "pauli",
    name: "Tes Pauli",
    setupPath: "/pauli",
    testPath: "/pauli/test",
    resultPath: "/pauli/result",
    directionLabel: "Jumlahkan dari atas ke bawah",
  },
  kraepelin: {
    kind: "kraepelin",
    name: "Tes Kraepelin",
    setupPath: "/kraepelin",
    testPath: "/kraepelin/test",
    resultPath: "/kraepelin/result",
    directionLabel: "Jumlahkan dari bawah ke atas",
  },
};
