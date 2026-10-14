"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { formatElapsed, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { pairsPerColumn } from "@/lib/test/config";
import { TEST_META } from "@/lib/test/meta";
import { computeResult } from "@/lib/test/score";
import { prepareSession, useSessionSnapshot } from "@/lib/test/store";
import type { EndReason, TestKind, TestResult } from "@/lib/test/types";
import { ResultChart, type ChartBar } from "./result-chart";
import { StatusPanel } from "./status-panel";
import { buttonPrimary, buttonSecondary, textLink } from "./ui";

const END_REASON_TEXT: Record<EndReason, string> = {
  time: "Waktu habis.",
  "sheet-complete": "Semua posisi di lembar sudah dijawab sebelum waktu habis.",
  manual: "Tes diakhiri sebelum waktu habis.",
};

export function ResultView({ kind }: { kind: TestKind }) {
  const meta = TEST_META[kind];
  const router = useRouter();
  const snapshot = useSessionSnapshot(kind);
  const session = snapshot?.session ?? null;
  const finished = session?.status === "finished" ? session : null;
  // Computed once per finished session; a finished session never changes.
  const result = useMemo(() => (finished ? computeResult(finished) : null), [finished]);

  if (snapshot === null) {
    return <StatusPanel title="Memuat hasil" busy>Membaca sesi yang tersimpan di tab ini.</StatusPanel>;
  }

  if (!session || !result) {
    const inProgress = session !== null && session.status !== "finished";
    return (
      <StatusPanel
        title={inProgress ? "Tes belum selesai" : `Belum ada hasil ${meta.name}`}
        actions={
          <Link href={inProgress ? meta.testPath : meta.setupPath} className={buttonPrimary}>
            {inProgress ? "Kembali ke tes" : `Atur ${meta.name}`}
          </Link>
        }
      >
        {inProgress
          ? "Hasil muncul setelah waktu habis atau setelah Anda mengakhiri tes."
          : snapshot.discardedInvalid
            ? "Data sesi yang tersimpan rusak atau tidak dikenali, jadi sudah dihapus."
            : "Hasil hanya tersimpan di tab browser ini sampai tab ditutup. Selesaikan satu sesi untuk melihat hasilnya di sini."}
      </StatusPanel>
    );
  }

  function restart() {
    prepareSession(result!.config);
    router.push(meta.testPath);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Hasil latihan {meta.name}</h1>
      <p className="mt-2 text-ink-muted">{END_REASON_TEXT[result.endReason]}</p>

      <p className="mt-6 max-w-2xl border-y border-rule py-3 text-sm text-ink-muted">
        Angka di halaman ini adalah statistik mentah dari satu sesi latihan di perangkat ini. Ini
        bukan skor psikotes terstandar, tidak dibandingkan dengan norma kelompok mana pun, dan tidak
        bisa dipakai untuk menilai kepribadian, kondisi psikologis, atau kelayakan kerja.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <section aria-labelledby="summary-title">
          <h2 id="summary-title" className="sr-only">
            Ringkasan
          </h2>
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="tabular font-serif text-6xl font-semibold">{formatNumber(result.correct)}</span>
            <span className="text-lg">jawaban benar</span>
          </p>
          <p className="mt-1 text-ink-muted">
            dari {formatNumber(result.answered)} yang dijawab, akurasi {formatPercent(result.accuracy)}
          </p>
          <SummaryList result={result} />
        </section>

        <section aria-labelledby="curve-title" className="flex flex-col gap-8">
          <h2 id="curve-title" className="font-serif text-2xl font-semibold">
            {kind === "kraepelin" ? "Per kolom" : "Per rentang waktu"}
          </h2>
          {kind === "kraepelin" ? <KraepelinBreakdown result={result} /> : <PauliBreakdown result={result} />}
        </section>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-rule pt-8 print:hidden">
        <button type="button" className={buttonPrimary} onClick={restart}>
          Ulangi dengan pengaturan sama
        </button>
        <Link href={meta.setupPath} className={buttonSecondary}>
          Ubah pengaturan
        </Link>
        <button type="button" className={buttonSecondary} onClick={() => window.print()}>
          <Printer aria-hidden className="size-4" />
          Cetak ringkasan
        </button>
        <Link href="/" className={textLink}>
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}

function SummaryList({ result }: { result: TestResult }) {
  const { config } = result;
  const rows: [string, string][] = [
    ["Jenis tes", TEST_META[config.kind].name],
    [
      "Durasi diatur",
      config.kind === "kraepelin"
        ? `${formatDuration(result.configuredDurationMs)} (${config.columnCount} kolom × ${config.columnSec} detik)`
        : formatDuration(result.configuredDurationMs),
    ],
    ["Waktu terpakai", formatElapsed(result.elapsedMs)],
    ["Total posisi jawaban", formatNumber(result.totalPositions)],
    ["Dijawab", formatNumber(result.answered)],
    ["Benar", formatNumber(result.correct)],
    ["Salah", formatNumber(result.incorrect)],
    ["Tidak dijawab", formatNumber(result.unanswered)],
    ["Akurasi (benar ÷ dijawab)", formatPercent(result.accuracy)],
    ["Penyelesaian (dijawab ÷ total)", formatPercent(result.completion)],
    ["Jeda", result.pauseCount === 0 ? "Tidak ada" : `${result.pauseCount} kali`],
  ];

  return (
    <dl className="mt-8 divide-y divide-rule border-y border-rule">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-2.5">
          <dt className="text-ink-muted">{label}</dt>
          <dd className="tabular text-right font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const th = "py-2 pr-4 text-left font-semibold";
const td = "tabular py-2 pr-4 text-left";

function KraepelinBreakdown({ result }: { result: TestResult }) {
  const bars: ChartBar[] = result.columns.map((c) => ({
    label: String(c.index + 1),
    name: `Kolom ${c.index + 1}`,
    correct: c.correct,
    incorrect: c.incorrect,
  }));

  return (
    <>
      <ResultChart
        title="Jumlah jawaban di setiap kolom"
        bars={bars}
        maxValue={pairsPerColumn(result.config)}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Statistik per kolom</caption>
          <thead className="border-b border-rule-strong">
            <tr>
              <th scope="col" className={th}>Kolom</th>
              <th scope="col" className={th}>Dijawab</th>
              <th scope="col" className={th}>Benar</th>
              <th scope="col" className={th}>Salah</th>
              <th scope="col" className={th}>Tidak dijawab</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {result.columns.map((c) => (
              <tr key={c.index}>
                <th scope="row" className={`${td} font-semibold`}>{c.index + 1}</th>
                <td className={td}>{c.answered}</td>
                <td className={td}>{c.correct}</td>
                <td className={td}>{c.incorrect}</td>
                <td className={td}>{c.unanswered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function rangeLabel(startMs: number, endMs: number): string {
  return `${formatElapsed(startMs)} sampai ${formatElapsed(endMs)}`;
}

function PauliBreakdown({ result }: { result: TestResult }) {
  const bars: ChartBar[] = result.intervals.map((i) => ({
    label: formatElapsed(i.endMs),
    name: rangeLabel(i.startMs, i.endMs),
    correct: i.correct,
    incorrect: i.incorrect,
  }));

  return (
    <>
      <ResultChart title="Jumlah jawaban di setiap rentang waktu" bars={bars} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Statistik per rentang waktu</caption>
          <thead className="border-b border-rule-strong">
            <tr>
              <th scope="col" className={th}>Rentang waktu</th>
              <th scope="col" className={th}>Dijawab</th>
              <th scope="col" className={th}>Benar</th>
              <th scope="col" className={th}>Salah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {result.intervals.map((i) => (
              <tr key={i.index}>
                <th scope="row" className={`${td} font-semibold`}>{rangeLabel(i.startMs, i.endMs)}</th>
                <td className={td}>{i.answered}</td>
                <td className={td}>{i.correct}</td>
                <td className={td}>{i.incorrect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
