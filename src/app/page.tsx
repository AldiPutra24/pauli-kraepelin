import Link from "next/link";
import { SheetColumn } from "@/components/sheet-column";
import { SiteHeader } from "@/components/site-header";
import { buttonPrimary } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { DEFAULT_CONFIG, pairsPerColumn, totalDurationMs } from "@/lib/test/config";
import { TEST_META } from "@/lib/test/meta";
import type { TestKind, WorkDirection } from "@/lib/test/types";

const pauli = DEFAULT_CONFIG.pauli;
const kraepelin = DEFAULT_CONFIG.kraepelin;

const TESTS: {
  kind: TestKind;
  summary: string;
  direction: WorkDirection;
  sample: { digits: number[]; answers: number[]; active: number };
  facts: [string, string][];
}[] = [
  {
    kind: "pauli",
    summary: "Satu waktu panjang untuk seluruh lembar. Anda bekerja terus tanpa sinyal pindah kolom.",
    direction: "down",
    sample: { digits: [7, 8, 2, 6, 3], answers: [5, 0], active: 2 },
    facts: [
      ["Arah", "Atas ke bawah"],
      ["Pindah kolom", "Setelah kolom penuh"],
      ["Waktu", "Satu hitung mundur"],
      [
        "Bawaan latihan",
        `${formatDuration(totalDurationMs(pauli))}, ${pauli.columnCount} kolom × ${pairsPerColumn(pauli)}`,
      ],
    ],
  },
  {
    kind: "kraepelin",
    summary: "Setiap kolom punya jatah waktu. Saat habis, tes pindah kolom dan kolom lama terkunci.",
    direction: "up",
    sample: { digits: [4, 9, 3, 8, 6], answers: [4, 1], active: 2 },
    facts: [
      ["Arah", "Bawah ke atas"],
      ["Pindah kolom", "Otomatis sesuai waktu"],
      ["Waktu", "Per kolom"],
      [
        "Bawaan latihan",
        `${kraepelin.columnCount} kolom × ${kraepelin.columnSec} detik (${formatDuration(totalDurationMs(kraepelin))})`,
      ],
    ],
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <section className="max-w-2xl py-12 sm:py-20">
          <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Latihan Tes Pauli dan Tes Kraepelin
          </h1>
          <p className="mt-5 text-lg text-ink-muted">
            Dua tes hitung berwaktu yang biasa muncul dalam psikotes seleksi kerja. Aturannya sama:
            jumlahkan dua angka yang berdekatan dan tulis angka terakhirnya saja. 7 + 8 = 15, jadi
            yang ditulis 5.
          </p>
          <p className="mt-3 text-lg text-ink-muted">
            Bisa langsung dimulai tanpa akun. Jawaban dan hasil hanya tersimpan di tab browser ini.
          </p>
        </section>

        <div className="grid border-t border-rule md:grid-cols-2">
          {TESTS.map((test, index) => {
            const meta = TEST_META[test.kind];
            return (
              <section
                key={test.kind}
                aria-labelledby={`${test.kind}-title`}
                className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 py-10 sm:gap-x-10 ${
                  index === 0 ? "md:border-r md:border-rule md:pr-10" : "border-t border-rule md:border-t-0 md:pl-10"
                }`}
              >
                <div>
                  <h2 id={`${test.kind}-title`} className="font-serif text-3xl font-semibold">
                    {meta.name}
                  </h2>
                  <p className="mt-3 text-ink-muted">{test.summary}</p>
                  <dl className="mt-6 space-y-2 text-sm">
                    {test.facts.map(([label, value]) => (
                      <div key={label} className="flex flex-wrap gap-x-2">
                        <dt className="text-ink-muted">{label}:</dt>
                        <dd className="font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link href={meta.setupPath} className={`${buttonPrimary} mt-8`}>
                    Atur {meta.name}
                  </Link>
                </div>
                <figure className="row-span-2 self-start rounded-md border border-rule bg-sheet px-2 py-3">
                  <SheetColumn
                    digits={test.sample.digits}
                    direction={test.direction}
                    answers={test.sample.answers}
                    activePair={test.sample.active}
                    size="sample"
                  />
                  <figcaption className="sr-only">
                    Contoh kolom {meta.name}, dikerjakan {test.direction === "down" ? "dari atas ke bawah" : "dari bawah ke atas"}.
                  </figcaption>
                </figure>
              </section>
            );
          })}
        </div>

        <section aria-labelledby="notes-title" className="border-t border-rule py-12 sm:py-16">
          <h2 id="notes-title" className="font-serif text-2xl font-semibold">
            Sebelum mulai
          </h2>
          <ul className="mt-5 grid max-w-3xl list-disc gap-3 pl-5 text-ink-muted marker:text-rule-strong">
            <li>
              Hasil berupa statistik mentah: jumlah benar, salah, tidak dijawab, dan kecepatan per
              kolom atau per menit. Tidak ada tafsiran kepribadian atau skor kelayakan kerja.
            </li>
            <li>
              Pengaturan bawaan adalah pengaturan latihan. Durasi, jumlah kolom, dan panjang kolom
              pada tes sesungguhnya bisa berbeda antar penyelenggara, jadi semuanya bisa diubah.
            </li>
            <li>
              Memuat ulang halaman tidak menghapus progres, dan waktu tetap dihitung selama itu.
              Menutup tab menghapus sesi dan hasilnya.
            </li>
          </ul>
        </section>
      </main>
      <footer className="border-t border-rule print:hidden">
        <p className="mx-auto max-w-5xl px-4 py-6 text-sm text-ink-muted sm:px-6">
          Latihan mandiri. Tidak ada jawaban atau hasil yang dikirim ke server.
        </p>
      </footer>
    </>
  );
}
