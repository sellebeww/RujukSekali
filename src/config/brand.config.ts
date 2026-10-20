// Single source of truth for every user-visible brand string. Renaming the product = editing this file.
const name = process.env.BRAND_NAME_OVERRIDE || 'RujukSekali';

export const brand = {
  name,
  shortName: name,
  tagline: 'Satu perjalanan, semua layanan beres.',
  description: `${name} menyusun beberapa layanan rumah sakit menjadi satu rangkaian kunjungan yang benar-benar bisa dijalani pasien dari luar kota.`,
  legalEntity: '[ISI: nama badan hukum]',
  contact: {
    email: '[ISI: email kontak]',
    whatsapp: '[ISI: nomor WhatsApp]',
    address: '[ISI: alamat kantor]',
  },
  locale: 'id-ID',
  // Colours live in src/app/globals.css as design tokens; listed here for metadata/OG use.
  themeColor: '#0b5aa6',
  demoHospital: 'RS Contoh Nusantara',
} as const;

export type Brand = typeof brand;
