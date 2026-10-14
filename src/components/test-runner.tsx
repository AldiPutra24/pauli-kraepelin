"use client";

import { ArrowDown, ArrowUp, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatClock, formatDuration, formatNumber } from "@/lib/format";
import { pairsPerColumn, totalDurationMs, totalPositions } from "@/lib/test/config";
import { TEST_META } from "@/lib/test/meta";
import { activeColumnAt, columnRemainingAt, elapsedAt } from "@/lib/test/session";
import { WORK_DIRECTION, columnDigits, upperDigitIndex } from "@/lib/test/sheet";
import { getSessionStore, prepareSession, useNow, useSessionSnapshot } from "@/lib/test/store";
import type { SessionAction, TestKind, TestSession } from "@/lib/test/types";
import { ConfirmDialog } from "./confirm-dialog";
import { Keypad } from "./keypad";
import { SheetColumn } from "./sheet-column";
import { StatusPanel } from "./status-panel";
import { buttonPrimary, buttonSecondary, textLink } from "./ui";

export function TestRunner({ kind }: { kind: TestKind }) {
  const meta = TEST_META[kind];
  const router = useRouter();
  const snapshot = useSessionSnapshot(kind);
  const session = snapshot?.session ?? null;
  const status = session?.status;
  const now = useNow(status === "running");

  const act = useCallback(
    (action: SessionAction) => {
      const { finishedNow } = getSessionStore(kind).dispatch(action);
      if (finishedNow) router.replace(meta.resultPath);
    },
    [kind, router, meta.resultPath],
  );

  // Deadline check on every clock update. The reducer ignores repeats, so
  // the result transition happens once even if this fires again.
  useEffect(() => {
    if (!session || session.status !== "running") return;
    if (elapsedAt(session, now) >= totalDurationMs(session.config)) {
      act({ type: "tick", now: Date.now() });
    }
  }, [session, now, act]);

  // Warn before closing or reloading the tab mid-test. Progress is kept in
  // sessionStorage either way, but the clock keeps running.
  useEffect(() => {
    if (status !== "running" && status !== "paused") return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  if (snapshot === null) {
    return <StatusPanel title="Memuat sesi tes" busy>Membaca sesi yang tersimpan di tab ini.</StatusPanel>;
  }

  const setupLink = (
    <Link href={meta.setupPath} className={buttonPrimary}>
      Atur {meta.name}
    </Link>
  );

  if (!session) {
    return snapshot.discardedInvalid ? (
      <StatusPanel title="Sesi tidak bisa dipulihkan" actions={setupLink}>
        Data sesi yang tersimpan di tab ini rusak atau tidak dikenali, jadi sudah dihapus. Atur tes
        lagi untuk memulai sesi baru.
      </StatusPanel>
    ) : (
      <StatusPanel title={`Belum ada sesi ${meta.name}`} actions={setupLink}>
        Sesi tes disiapkan dari halaman pengaturan. Pilih durasi dan ukuran lembar di sana, lalu mulai.
      </StatusPanel>
    );
  }

  if (session.status === "finished") {
    return (
      <StatusPanel
        title="Sesi ini sudah selesai"
        actions={
          <>
            <Link href={meta.resultPath} className={buttonPrimary}>
              Lihat hasil
            </Link>
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => prepareSession(session.config)}
            >
              Ulangi dengan pengaturan sama
            </button>
          </>
        }
      >
        Jawaban tidak bisa diubah lagi setelah tes berakhir.
      </StatusPanel>
    );
  }

  if (session.status === "ready") {
    return <ReadyScreen session={session} onStart={() => act({ type: "start", now: Date.now() })} />;
  }

  return <ActiveTest session={session} now={now} act={act} />;
}

function ReadyScreen({ session, onStart }: { session: TestSession; onStart: () => void }) {
  const { config } = session;
  const meta = TEST_META[config.kind];
  const rows: [string, string][] =
    config.kind === "pauli"
      ? [
          ["Durasi", formatDuration(config.durationSec * 1000)],
          ["Lembar", `${config.columnCount} kolom × ${pairsPerColumn(config)} penjumlahan`],
        ]
      : [
          ["Waktu per kolom", formatDuration(config.columnSec * 1000)],
          ["Lembar", `${config.columnCount} kolom × ${pairsPerColumn(config)} penjumlahan`],
          ["Durasi total", formatDuration(totalDurationMs(config))],
        ];

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:py-20">
      <h1 className="font-serif text-3xl font-semibold">{meta.name}</h1>
      <p className="mt-2 text-ink-muted">Waktu mulai berjalan begitu Anda menekan tombol mulai.</p>

      <dl className="mt-8 divide-y divide-rule border-y border-rule">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-3">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-6 list-disc space-y-1.5 pl-5 text-ink-muted marker:text-rule-strong">
        <li>
          {meta.directionLabel}, lalu ketik angka terakhir hasilnya. Contoh: 7 + 8 = 15, ketik 5.
        </li>
        <li>Gunakan angka 0 sampai 9 di keyboard, atau papan angka di layar.</li>
        <li>Backspace atau tombol Hapus membatalkan jawaban terakhir di kolom yang sedang aktif.</li>
      </ul>

      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
        <button type="button" className={buttonPrimary} onClick={onStart} autoFocus>
          Mulai sekarang
        </button>
        <Link href={meta.setupPath} className={textLink}>
          Ubah pengaturan
        </Link>
      </div>
    </div>
  );
}

interface ActiveTestProps {
  session: TestSession;
  now: number;
  act: (action: SessionAction) => void;
}

function ActiveTest({ session, now, act }: ActiveTestProps) {
  const { config } = session;
  const meta = TEST_META[config.kind];
  const direction = WORK_DIRECTION[config.kind];
  const paused = session.status === "paused";
  const [confirmOpen, setConfirmOpen] = useState(false);

  const elapsed = elapsedAt(session, now);
  const remaining = totalDurationMs(config) - elapsed;
  const columnIndex = activeColumnAt(session, elapsed);
  const pairs = pairsPerColumn(config);
  const entries = session.columns[columnIndex];
  const columnFull = entries.length >= pairs;
  const activePair = columnFull ? null : entries.length;
  const answered = session.columns.reduce((sum, column) => sum + column.length, 0);

  const digits = columnDigits(session.seed, columnIndex, config.columnLength);
  const answers = entries.map((entry) => entry.value);

  // Kraepelin input is tagged with the column on screen, so a key pressed in
  // the moment between a column's deadline and the next repaint is dropped
  // rather than recorded in a column the participant has not seen.
  const screenColumn = config.kind === "kraepelin" ? columnIndex : undefined;
  const screenColumnRef = useRef(screenColumn);
  useLayoutEffect(() => {
    screenColumnRef.current = screenColumn;
  });

  // Physical keyboard: digits answer, Backspace/Delete erase.
  useEffect(() => {
    if (paused) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      const column = screenColumnRef.current;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        act({ type: "input", value: Number(event.key), now: Date.now(), column });
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        act({ type: "erase", now: Date.now(), column });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paused, act]);

  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    const slot = viewport?.querySelector<HTMLElement>("[data-active-slot]");
    if (!viewport || !slot) return;
    viewport.scrollTop = slot.offsetTop - viewport.clientHeight / 2 + slot.offsetHeight / 2;
  }, [columnIndex, activePair, paused]);

  const activeTop = activePair === null ? -1 : upperDigitIndex(activePair, digits.length, direction);
  const DirectionIcon = direction === "down" ? ArrowDown : ArrowUp;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <h1 className="font-serif text-lg font-semibold">{meta.name}</h1>
          <div className="flex gap-2">
            <button
              type="button"
              className={`${buttonSecondary} px-3 sm:px-4`}
              onClick={() => act({ type: paused ? "resume" : "pause", now: Date.now() })}
            >
              {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
              {paused ? "Lanjutkan" : "Jeda"}
            </button>
            <button
              type="button"
              className={`${buttonSecondary} px-3 sm:px-4`}
              onClick={() => setConfirmOpen(true)}
            >
              Akhiri
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          {config.kind === "kraepelin" ? (
            <KraepelinStatus
              columnIndex={columnIndex}
              columnCount={config.columnCount}
              columnRemaining={columnRemainingAt(session, elapsed)}
              totalRemaining={remaining}
              completedThrough={columnIndex}
            />
          ) : (
            <PauliStatus
              remaining={remaining}
              answered={answered}
              total={totalPositions(config)}
              columnIndex={columnIndex}
              columnCount={config.columnCount}
            />
          )}
        </div>
      </div>

      <main className="mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-1 lg:gap-8 lg:px-6">
        <section aria-label="Lembar kerja" className="flex min-h-0 flex-col">
          <p className="flex items-center justify-center gap-2 pt-3 pb-1 text-sm text-ink-muted">
            <DirectionIcon aria-hidden className="size-4" />
            {meta.directionLabel}
            <span aria-hidden>·</span>
            <span className="tabular">
              {Math.min(entries.length, pairs)}/{pairs}
            </span>
          </p>
          {paused ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <h2 className="font-serif text-2xl font-semibold">Tes dijeda</h2>
              <p className="mt-2 max-w-sm text-ink-muted">
                Angka disembunyikan selama jeda. Waktu berhenti di {formatClock(remaining)} dan
                berjalan lagi saat Anda melanjutkan.
              </p>
              <button
                type="button"
                className={`${buttonPrimary} mt-6`}
                onClick={() => act({ type: "resume", now: Date.now() })}
                autoFocus
              >
                <Play aria-hidden className="size-4" />
                Lanjutkan tes
              </button>
            </div>
          ) : (
            <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain py-6">
              <SheetColumn
                key={columnIndex}
                digits={digits}
                direction={direction}
                answers={answers}
                activePair={activePair}
              />
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            {activeTop >= 0 && !paused
              ? `${digits[activeTop]} tambah ${digits[activeTop + 1]}`
              : ""}
          </p>
        </section>

        <aside className="border-t border-rule bg-sheet px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:self-center lg:rounded-lg lg:border lg:p-5">
          <p className="mb-3 min-h-6 text-sm text-ink-muted lg:min-h-0 lg:empty:mb-0" aria-live="polite">
            {columnFull && !paused && config.kind === "kraepelin"
              ? "Kolom ini sudah penuh. Kolom berikutnya mulai otomatis."
              : ""}
          </p>
          <Keypad
            disabled={paused || columnFull}
            canErase={entries.length > 0}
            onDigit={(value) => act({ type: "input", value, now: Date.now(), column: screenColumn })}
            onErase={() => act({ type: "erase", now: Date.now(), column: screenColumn })}
          />
          <p className="mt-4 hidden text-sm text-ink-muted lg:block">
            Keyboard: ketik 0 sampai 9. Backspace menghapus jawaban terakhir di kolom aktif.
          </p>
        </aside>
      </main>

      <ConfirmDialog
        open={confirmOpen}
        title="Akhiri tes sekarang?"
        description={`Waktu masih tersisa ${formatClock(remaining)}. Posisi yang belum dijawab dihitung sebagai tidak dijawab. Waktu tetap berjalan selama pesan ini terbuka.`}
        confirmLabel="Akhiri dan lihat hasil"
        cancelLabel="Kembali ke tes"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          act({ type: "finish", now: Date.now() });
        }}
      />
    </div>
  );
}

function Clock({ label, ms, large }: { label: string; ms: number; large?: boolean }) {
  return (
    <div role="timer" aria-label={label} className="flex items-baseline gap-2">
      <span className="text-sm text-ink-muted" aria-hidden>
        {label}
      </span>
      <span className={`tabular font-semibold ${large ? "text-3xl" : "text-lg"}`}>
        {formatClock(ms)}
      </span>
    </div>
  );
}

function PauliStatus(props: {
  remaining: number;
  answered: number;
  total: number;
  columnIndex: number;
  columnCount: number;
}) {
  const percent = props.total === 0 ? 0 : (props.answered / props.total) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <Clock label="Sisa waktu" ms={props.remaining} large />
        <p className="tabular text-sm text-ink-muted">
          Kolom {props.columnIndex + 1} dari {props.columnCount} ·{" "}
          {formatNumber(props.answered)} dari {formatNumber(props.total)} terjawab
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Posisi terjawab"
        aria-valuemin={0}
        aria-valuemax={props.total}
        aria-valuenow={props.answered}
        className="h-1.5 overflow-hidden rounded-full bg-rule"
      >
        <div className="h-full bg-ink" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function KraepelinStatus(props: {
  columnIndex: number;
  columnCount: number;
  columnRemaining: number;
  totalRemaining: number;
  completedThrough: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p className="tabular font-semibold" aria-live="polite">
            Kolom {props.columnIndex + 1} dari {props.columnCount}
          </p>
          <Clock label="Sisa kolom" ms={props.columnRemaining} large />
        </div>
        <Clock label="Sisa total" ms={props.totalRemaining} />
      </div>
      {/* Column strip: filled = finished and locked, outlined accent = current. */}
      <ol className="flex flex-wrap gap-1" aria-hidden>
        {Array.from({ length: props.columnCount }, (_, index) => (
          <li
            key={index}
            className={`h-2 w-3 rounded-[2px] ${
              index < props.completedThrough
                ? "bg-ink-muted"
                : index === props.columnIndex
                  ? "bg-accent"
                  : "border border-rule-strong"
            }`}
          />
        ))}
      </ol>
    </div>
  );
}
