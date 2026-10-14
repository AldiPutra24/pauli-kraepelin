"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { formatClock, formatDuration, formatNumber } from "@/lib/format";
import {
  DEFAULT_CONFIG,
  LIMITS,
  PAULI_INTERVAL_OPTIONS,
  type Range,
  totalDurationMs,
  totalPositions,
} from "@/lib/test/config";
import { TEST_META } from "@/lib/test/meta";
import { prepareSession, useSessionSnapshot } from "@/lib/test/store";
import type { TestConfig, TestKind } from "@/lib/test/types";
import { buttonPrimary, buttonSecondary, textLink } from "./ui";

type FieldKey = "durationMin" | "columnSec" | "columnCount" | "columnLength";

interface FieldDef {
  key: FieldKey;
  label: string;
  hint: string;
  range: Range;
}

const FIELDS: Record<TestKind, FieldDef[]> = {
  pauli: [
    { key: "durationMin", label: "Durasi (menit)", hint: "Satu waktu untuk seluruh lembar.", range: LIMITS.durationMin },
    { key: "columnCount", label: "Jumlah kolom", hint: "Kolom berikutnya terbuka setelah kolom sebelumnya penuh.", range: LIMITS.columnCount },
    { key: "columnLength", label: "Angka per kolom", hint: "Satu kolom berisi jumlah angka dikurangi satu penjumlahan.", range: LIMITS.columnLength },
  ],
  kraepelin: [
    { key: "columnSec", label: "Waktu per kolom (detik)", hint: "Saat habis, tes pindah ke kolom berikutnya.", range: LIMITS.columnSec },
    { key: "columnCount", label: "Jumlah kolom", hint: "Durasi total adalah jumlah kolom dikali waktu per kolom.", range: LIMITS.columnCount },
    { key: "columnLength", label: "Angka per kolom", hint: "Satu kolom berisi jumlah angka dikurangi satu penjumlahan.", range: LIMITS.columnLength },
  ],
};

type Values = Record<FieldKey, string> & { intervalSec: string };

function toValues(config: TestConfig): Values {
  return {
    durationMin: config.kind === "pauli" ? String(config.durationSec / 60) : "",
    columnSec: config.kind === "kraepelin" ? String(config.columnSec) : "",
    columnCount: String(config.columnCount),
    columnLength: String(config.columnLength),
    intervalSec: config.kind === "pauli" ? String(config.intervalSec) : "",
  };
}

function fieldError(field: FieldDef, raw: string): string | null {
  if (raw.trim() === "") return "Wajib diisi.";
  const value = Number(raw);
  if (!Number.isInteger(value)) return "Gunakan bilangan bulat.";
  if (value < field.range.min || value > field.range.max) {
    return `Isi antara ${field.range.min} dan ${field.range.max}.`;
  }
  return null;
}

function intervalOptions(durationMin: number): number[] {
  return PAULI_INTERVAL_OPTIONS.filter((sec) => sec <= durationMin * 60);
}

function buildConfig(kind: TestKind, values: Values): TestConfig | null {
  if (FIELDS[kind].some((field) => fieldError(field, values[field.key]))) return null;
  const columnCount = Number(values.columnCount);
  const columnLength = Number(values.columnLength);
  if (kind === "kraepelin") {
    return { kind, columnCount, columnLength, columnSec: Number(values.columnSec) };
  }
  const durationMin = Number(values.durationMin);
  const options = intervalOptions(durationMin);
  const wanted = Number(values.intervalSec);
  // A shorter duration can rule out the chosen marker; fall back to the largest that fits.
  const intervalSec = options.includes(wanted) ? wanted : options[options.length - 1];
  return { kind, columnCount, columnLength, durationSec: durationMin * 60, intervalSec };
}

export function TestSetup({ kind }: { kind: TestKind }) {
  const snapshot = useSessionSnapshot(kind);
  const session = snapshot?.session ?? null;
  const unfinished = session !== null && (session.status === "running" || session.status === "paused");
  const meta = TEST_META[kind];

  return (
    <div className="flex flex-col gap-6">
      {unfinished && (
        <div role="status" className="rounded-lg border border-rule-strong bg-sheet p-5">
          <h2 className="font-semibold">Ada sesi yang belum selesai</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {session.status === "paused"
              ? `Sesi dijeda dengan sisa waktu ${formatClock(totalDurationMs(session.config) - session.elapsedMs)}.`
              : "Sesi masih berjalan dan waktunya tidak berhenti selama Anda di halaman ini."}
          </p>
          <Link href={meta.testPath} className={`${buttonSecondary} mt-4`}>
            Lanjutkan sesi
          </Link>
        </div>
      )}
      <ConfigForm
        key={session?.id ?? "default"}
        kind={kind}
        initial={session?.config ?? DEFAULT_CONFIG[kind]}
        replacesUnfinished={unfinished}
      />
    </div>
  );
}

function ConfigForm({
  kind,
  initial,
  replacesUnfinished,
}: {
  kind: TestKind;
  initial: TestConfig;
  replacesUnfinished: boolean;
}) {
  const router = useRouter();
  const meta = TEST_META[kind];
  const idPrefix = useId();
  const [values, setValues] = useState<Values>(() => toValues(initial));
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [starting, setStarting] = useState(false);

  const config = buildConfig(kind, values);
  const durationMin = Number(values.durationMin);
  const options = kind === "pauli" && Number.isInteger(durationMin) ? intervalOptions(durationMin) : [];

  function update(key: keyof Values, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!config || starting) return;
    setStarting(true);
    prepareSession(config);
    router.push(meta.testPath);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="rounded-lg border border-rule bg-sheet p-5 sm:p-6">
      <h2 className="font-serif text-xl font-semibold">Pengaturan latihan</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Nilai bawaan dipilih untuk latihan singkat, bukan prosedur resmi. Sesuaikan dengan format
        tes yang sedang Anda persiapkan.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        {FIELDS[kind].map((field) => {
          const id = `${idPrefix}-${field.key}`;
          const error = touched[field.key] || submitted ? fieldError(field, values[field.key]) : null;
          return (
            <div key={field.key}>
              <label htmlFor={id} className="block font-semibold">
                {field.label}
              </label>
              <p id={`${id}-hint`} className="text-sm text-ink-muted">
                {field.hint} Rentang {field.range.min} sampai {field.range.max}.
              </p>
              <input
                id={id}
                type="number"
                inputMode="numeric"
                min={field.range.min}
                max={field.range.max}
                step={1}
                value={values[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, [field.key]: true }))}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
                className={`tabular mt-2 h-11 w-32 rounded-md border bg-paper px-3 text-lg ${
                  error ? "border-2 border-wrong" : "border-rule-strong"
                }`}
              />
              {error && (
                <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-wrong">
                  {error}
                </p>
              )}
            </div>
          );
        })}

        {kind === "pauli" && options.length > 0 && (
          <div>
            <label htmlFor={`${idPrefix}-interval`} className="block font-semibold">
              Penanda waktu di hasil
            </label>
            <p id={`${idPrefix}-interval-hint`} className="text-sm text-ink-muted">
              Hasil menampilkan jumlah jawaban untuk setiap rentang waktu ini.
            </p>
            <select
              id={`${idPrefix}-interval`}
              aria-describedby={`${idPrefix}-interval-hint`}
              value={options.includes(Number(values.intervalSec)) ? values.intervalSec : String(options[options.length - 1])}
              onChange={(event) => update("intervalSec", event.target.value)}
              className="mt-2 h-11 rounded-md border border-rule-strong bg-paper px-3 text-lg"
            >
              {options.map((sec) => (
                <option key={sec} value={sec}>
                  Setiap {formatDuration(sec * 1000)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <p className="mt-6 border-t border-rule pt-4 text-sm text-ink-muted" aria-live="polite">
        {config
          ? `${formatNumber(totalPositions(config))} posisi jawaban, durasi ${formatDuration(totalDurationMs(config))}.`
          : "Perbaiki isian yang ditandai untuk melihat ringkasan."}
      </p>

      {replacesUnfinished && (
        <p className="mt-2 text-sm font-semibold">Memulai sesi baru membuang sesi yang belum selesai.</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        <button type="submit" className={buttonPrimary} disabled={starting}>
          {replacesUnfinished ? `Mulai ${meta.name} baru` : `Mulai ${meta.name}`}
        </button>
        <button
          type="button"
          className={textLink}
          onClick={() => {
            setValues(toValues(DEFAULT_CONFIG[kind]));
            setTouched({});
            setSubmitted(false);
          }}
        >
          Kembalikan nilai bawaan
        </button>
      </div>
    </form>
  );
}
