import { TEST_META } from "@/lib/test/meta";
import type { TestKind } from "@/lib/test/types";
import { SiteHeader } from "./site-header";
import { TestSetup } from "./test-setup";

const INTRO: Record<TestKind, string> = {
  pauli:
    "Lembar berisi kolom-kolom angka. Anda menjumlahkan dari atas ke bawah dan terus bekerja sampai waktu habis.",
  kraepelin:
    "Lembar berisi kolom-kolom angka. Anda menjumlahkan dari bawah ke atas, dan setiap kolom punya jatah waktu sendiri.",
};

const STEPS: Record<TestKind, string[]> = {
  pauli: [
    "Jumlahkan dua angka yang berdekatan, mulai dari angka paling atas di kolom.",
    "Ketik angka terakhir dari hasilnya saja. 7 + 8 = 15, ketik 5. 4 + 3 = 7, ketik 7.",
    "Setelah satu kolom penuh, kolom berikutnya terbuka otomatis. Kolom yang sudah penuh tidak bisa diubah.",
    "Kerjakan secepat dan seteliti mungkin sampai waktu habis. Selama tes tidak ada tanda benar atau salah.",
    "Salah ketik? Backspace atau tombol Hapus membatalkan jawaban terakhir di kolom yang sedang dikerjakan.",
  ],
  kraepelin: [
    "Jumlahkan dua angka yang berdekatan, mulai dari angka paling bawah di kolom, lalu naik.",
    "Ketik angka terakhir dari hasilnya saja. 9 + 6 = 15, ketik 5.",
    "Saat waktu kolom habis, tes pindah ke kolom berikutnya walaupun kolom belum selesai. Kolom sebelumnya terkunci.",
    "Kalau kolom selesai lebih cepat, tunggu sampai kolom berikutnya dimulai.",
    "Backspace atau tombol Hapus membatalkan jawaban terakhir, hanya di kolom yang sedang berjalan.",
  ],
};

export function SetupPage({ kind }: { kind: TestKind }) {
  const meta = TEST_META[kind];
  return (
    <>
      <SiteHeader current={kind} />
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">{meta.name}</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-muted">{INTRO[kind]}</p>

          <h2 className="mt-10 font-serif text-2xl font-semibold">Cara mengerjakan</h2>
          <ol className="mt-4 max-w-xl space-y-3">
            {STEPS[kind].map((step, index) => (
              <li key={index} className="grid grid-cols-[1.75rem_minmax(0,1fr)]">
                <span className="tabular font-serif font-semibold text-ink-muted">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <p className="mt-8 max-w-xl text-sm text-ink-muted">
            Angka di layar dibuat acak setiap sesi. Hasilnya adalah statistik latihan mentah, bukan
            skor psikotes terstandar.
          </p>
        </div>
        <TestSetup kind={kind} />
      </main>
    </>
  );
}
