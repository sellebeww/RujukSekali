import type { Metadata } from 'next';
import { LegalDraft } from '@/components/marketing/LegalDraft';
import { Placeholder } from '@/components/ui';
import { brand } from '@/config/brand.config';

export const metadata: Metadata = { title: 'Kebijakan privasi (draf)' };

export default function KebijakanPrivasi() {
  return (
    <LegalDraft title="Kebijakan privasi">
      <h2>Siapa kami</h2>
      <p>
        {brand.name} dikelola oleh <Placeholder>{brand.legalEntity}</Placeholder>. Kontak:{' '}
        <Placeholder>{brand.contact.email}</Placeholder>.
      </p>
      <h2>Data dari formulir permintaan demo</h2>
      <p>
        Kami menyimpan nama, instansi, peran, kontak, dan kebutuhan yang Anda tulis, beserta waktu Anda
        menyetujui penggunaannya. Data ini hanya dipakai untuk menindaklanjuti permintaan Anda, disimpan
        terpisah dari data operasional, dan dapat dihapus atas permintaan.
      </p>
      <h2>Data dalam aplikasi</h2>
      <p>
        Versi ini hanya memakai data sintetis. Saat dipakai rumah sakit mitra, rumah sakit adalah pihak yang
        menentukan tujuan pemrosesan data pasien; ketentuan rinci akan diatur dalam perjanjian dengan rumah
        sakit. <Placeholder>[ISI: peran pengendali/prosesor data setelah ditinjau hukum]</Placeholder>
      </p>
      <h2>Cookie</h2>
      <p>
        Kami hanya memakai cookie yang diperlukan agar layanan berfungsi (sesi masuk petugas, sesi tautan
        pasien, dan penanda halaman asal saat mencoba demo). Tidak ada cookie iklan atau pelacak pihak ketiga.
      </p>
      <h2>Masa simpan</h2>
      <p>
        <Placeholder>[ISI: masa simpan data permintaan demo dan log teknis]</Placeholder>
      </p>
    </LegalDraft>
  );
}
