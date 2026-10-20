import type { Metadata } from 'next';
import { LegalDraft } from '@/components/marketing/LegalDraft';
import { Placeholder } from '@/components/ui';
import { brand } from '@/config/brand.config';

export const metadata: Metadata = { title: 'Syarat penggunaan (draf)' };

export default function Syarat() {
  return (
    <LegalDraft title="Syarat penggunaan">
      <h2>Sifat layanan</h2>
      <p>
        {brand.name} adalah alat koordinasi jadwal dan logistik. Layanan ini tidak memberikan saran medis,
        tidak menentukan prioritas klinis, dan tidak menggantikan penilaian tenaga kesehatan. Untuk keadaan
        darurat, segera ke IGD atau hubungi 119.
      </p>
      <h2>Mode demo</h2>
      <p>
        Mode demo berisi data sintetis yang dapat diatur ulang kapan saja. Jangan memasukkan data pribadi atau
        data pasien sungguhan ke dalam demo.
      </p>
      <h2>Ketersediaan</h2>
      <p>Versi MVP disediakan apa adanya untuk evaluasi dan pilot.</p>
      <h2>Hukum yang berlaku</h2>
      <p>
        <Placeholder>[ISI: yurisdiksi dan penyelesaian sengketa setelah ditinjau hukum]</Placeholder>
      </p>
    </LegalDraft>
  );
}
