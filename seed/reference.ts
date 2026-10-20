// Synthetic reference data. Every name here is fictional (hospital, regencies, transport operators).
import { brand } from '@/config/brand.config';

export const FACILITY = { code: 'RSCN', name: brand.demoHospital, city: 'Kota Contoh' };

export const SERVICE_TYPES = [
  {
    code: 'LAB_DARAH',
    name: 'Pemeriksaan darah (laboratorium)',
    shortName: 'Lab darah',
    durationMin: 15,
    fasting: true,
    latestStartLocal: '10:00',
    resultReadyMin: 180,
    prepNote: 'Puasa 10–12 jam sebelumnya; minum air putih boleh.',
    holdTtlMinutes: { singkat: 120, standar: 1440, panjang: 2880 },
    maxHoldRatio: 0.3,
    maxExtensions: 2,
    sortOrder: 1,
    units: [
      { name: 'Laboratorium — Bilik Sampling 1', location: 'Gedung A, Lantai 1, Loket 3' },
      { name: 'Laboratorium — Bilik Sampling 2', location: 'Gedung A, Lantai 1, Loket 4' },
    ],
    open: { from: '07:00', to: '14:00', days: [1, 2, 3, 4, 5, 6] },
  },
  {
    code: 'POLI_PD',
    name: 'Konsultasi Poli Penyakit Dalam',
    shortName: 'Poli Penyakit Dalam',
    durationMin: 20,
    fasting: false,
    latestStartLocal: null,
    resultReadyMin: 0,
    prepNote: 'Bawa hasil pemeriksaan sebelumnya bila ada.',
    holdTtlMinutes: { singkat: 120, standar: 1440, panjang: 2880 },
    maxHoldRatio: 0.3,
    maxExtensions: 2,
    sortOrder: 2,
    units: [
      { name: 'Poli Penyakit Dalam — Ruang 1', location: 'Gedung B, Lantai 2, Ruang 204' },
      { name: 'Poli Penyakit Dalam — Ruang 2', location: 'Gedung B, Lantai 2, Ruang 206' },
    ],
    open: { from: '08:00', to: '15:00', days: [1, 2, 3, 4, 5] },
  },
] as const;

export const REGENCIES = [
  { name: 'Kab. Lembah Hijau', distanceKm: 60, travelMinutes: 90 },
  { name: 'Kab. Sukamaju', distanceKm: 120, travelMinutes: 150 },
  { name: 'Kab. Bukit Raya', distanceKm: 160, travelMinutes: 210 },
  { name: 'Kab. Tanjung Asri', distanceKm: 210, travelMinutes: 270 },
  { name: 'Kota Pesisir Jaya', distanceKm: 300, travelMinutes: 360 },
] as const;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5, 6];

export const TRANSPORT = [
  {
    originRegency: 'Kab. Lembah Hijau',
    mode: 'bus',
    label: 'Bus Antarkota Lembah Hijau',
    departLocal: '05:30',
    arriveLocal: '07:00',
    returnDepartLocal: '16:00',
    returnArriveLocal: '17:30',
    fareIdr: 35_000,
    daysOfWeek: ALL_DAYS,
  },
  {
    originRegency: 'Kab. Lembah Hijau',
    mode: 'travel',
    label: 'Travel Hijau Lestari',
    departLocal: '07:00',
    arriveLocal: '08:30',
    returnDepartLocal: '18:00',
    returnArriveLocal: '19:30',
    fareIdr: 75_000,
    daysOfWeek: ALL_DAYS,
  },
  {
    originRegency: 'Kab. Sukamaju',
    mode: 'bus',
    label: 'Bus Pagi Sukamaju',
    departLocal: '04:30',
    arriveLocal: '07:00',
    returnDepartLocal: '16:00',
    returnArriveLocal: '18:30',
    fareIdr: 60_000,
    daysOfWeek: ALL_DAYS,
  },
  {
    originRegency: 'Kab. Sukamaju',
    mode: 'travel',
    label: 'Travel Sukamaju Ekspres',
    departLocal: '05:30',
    arriveLocal: '08:00',
    returnDepartLocal: '17:30',
    returnArriveLocal: '20:00',
    fareIdr: 110_000,
    daysOfWeek: WEEKDAYS,
  },
  {
    originRegency: 'Kab. Bukit Raya',
    mode: 'bus',
    label: 'Bus Bukit Raya',
    departLocal: '04:00',
    arriveLocal: '07:30',
    returnDepartLocal: '15:30',
    returnArriveLocal: '19:00',
    fareIdr: 85_000,
    daysOfWeek: [1, 3, 5, 6],
  },
  {
    originRegency: 'Kab. Bukit Raya',
    mode: 'travel',
    label: 'Travel Raya Sejahtera',
    departLocal: '05:00',
    arriveLocal: '08:30',
    returnDepartLocal: '17:00',
    returnArriveLocal: '20:30',
    fareIdr: 140_000,
    daysOfWeek: ALL_DAYS,
  },
  {
    originRegency: 'Kab. Tanjung Asri',
    mode: 'bus',
    label: 'Bus Malam Tanjung Asri',
    departLocal: '02:30',
    arriveLocal: '07:00',
    returnDepartLocal: '15:00',
    returnArriveLocal: '19:30',
    fareIdr: 120_000,
    daysOfWeek: ALL_DAYS,
  },
  {
    originRegency: 'Kota Pesisir Jaya',
    mode: 'kereta',
    label: 'Kereta Pesisir Pagi',
    departLocal: '01:30',
    arriveLocal: '07:30',
    returnDepartLocal: '14:30',
    returnArriveLocal: '20:30',
    fareIdr: 180_000,
    daysOfWeek: [1, 2, 3, 4, 5],
  },
  {
    originRegency: 'Kota Pesisir Jaya',
    mode: 'bus',
    label: 'Bus Pesisir Jaya',
    departLocal: '02:00',
    arriveLocal: '08:00',
    returnDepartLocal: '15:30',
    returnArriveLocal: '21:30',
    fareIdr: 150_000,
    daysOfWeek: ALL_DAYS,
  },
];

export const STAFF = [
  { email: 'koordinator@rs-contoh.test', name: 'Koordinator Contoh', role: 'coordinator' as const },
  { email: 'admin.unit@rs-contoh.test', name: 'Admin Unit Contoh', role: 'unit_admin' as const },
  { email: 'admin@rs-contoh.test', name: 'Admin Sistem Contoh', role: 'system_admin' as const },
];
