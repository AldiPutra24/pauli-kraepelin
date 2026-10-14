import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StatusPanel } from "@/components/status-panel";
import { buttonPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <StatusPanel
        title="Halaman tidak ditemukan"
        actions={
          <Link href="/" className={buttonPrimary}>
            Ke halaman utama
          </Link>
        }
      >
        Alamat ini tidak ada. Aplikasi ini hanya berisi Tes Pauli dan Tes Kraepelin.
      </StatusPanel>
    </>
  );
}
