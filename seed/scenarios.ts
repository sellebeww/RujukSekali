// Acceptance scenarios as reusable templates: used by the seed, the demo sandbox and integration tests.
import { addDays, dayOfWeek } from '@/lib/time';
import type { NewEpisode } from '@/server/usecases/episodes';

export type ScenarioId = '1' | '2' | '3' | '4' | '5';

/** First Mon–Thu on/after `from`, so the following day is also a clinic day. */
export function nextPairDay(from: string): string {
  let d = from;
  while (![1, 2, 3, 4].includes(dayOfWeek(d))) d = addDays(d, 1);
  return d;
}

/** Days the seed deliberately fills to create scenario 4 (poli full after lab results; lab full next day). */
export function specialDays(startDate: string) {
  const busyPoli = nextPairDay(addDays(startDate, 4));
  return { busyPoli, busyLab: addDays(busyPoli, 1) };
}

export interface ScenarioTemplate {
  id: ScenarioId;
  title: string;
  short: string;
  build(startDate: string, label: string): NewEpisode;
}

const base = (
  startDate: string,
): Pick<NewEpisode, 'serviceCodes' | 'priority' | 'urgent' | 'holdTier' | 'includeLostIncome'> & {
  earliestDate: string;
  latestDate: string;
} => ({
  serviceCodes: ['LAB_DARAH', 'POLI_PD'],
  earliestDate: addDays(startDate, 1),
  latestDate: addDays(startDate, 12),
  priority: 'rutin',
  urgent: false,
  holdTier: 'standar',
  includeLostIncome: true,
});

const verifiedReferral = (startDate: string) => [
  {
    kind: 'surat_rujukan' as const,
    label: 'Surat rujukan',
    status: 'verified' as const,
    validUntil: addDays(startDate, 80),
  },
];

export const SCENARIOS: Record<ScenarioId, ScenarioTemplate> = {
  '1': {
    id: '1',
    title: 'Jalur ideal: selesai dalam 1 hari',
    short: 'Lab pagi (puasa) dan konsultasi siang di hari yang sama.',
    build: (s, label) => ({
      ...base(s),
      title: 'Pemeriksaan lanjutan penyakit dalam',
      patient: {
        pseudonym: label,
        originRegency: 'Kab. Sukamaju',
        distanceKm: 120,
        travelMinutes: 150,
        mobilityNeeds: [],
      },
      requiresEscort: false,
      documents: verifiedReferral(s),
      scenario: '1',
    }),
  },
  '2': {
    id: '2',
    title: 'Dokumen belum siap',
    short: 'Jadwal ditahan dulu; baru pasti setelah surat rujukan diverifikasi.',
    build: (s, label) => ({
      ...base(s),
      title: 'Kontrol penyakit dalam dengan hasil lab',
      patient: {
        pseudonym: label,
        originRegency: 'Kab. Lembah Hijau',
        distanceKm: 60,
        travelMinutes: 90,
        mobilityNeeds: [],
      },
      requiresEscort: false,
      documents: [
        { kind: 'surat_rujukan', label: 'Surat rujukan' },
        { kind: 'hasil_lama', label: 'Hasil pemeriksaan sebelumnya' },
      ],
      scenario: '2',
    }),
  },
  '3': {
    id: '3',
    title: 'Pendamping tidak tersedia di hari terbaik',
    short: 'Sistem memilih hari ketika pendamping bisa ikut.',
    build: (s, label) => {
      // The escort can only come on four clinic days starting ~5 days out, so the earliest days are skipped.
      const windows: string[] = [];
      for (let d = addDays(s, 5); windows.length < 4; d = addDays(d, 1))
        if ([1, 2, 3, 4, 5].includes(dayOfWeek(d))) windows.push(d);
      return {
        ...base(s),
        title: 'Pemeriksaan lanjutan dengan pendamping',
        patient: {
          pseudonym: label,
          originRegency: 'Kab. Bukit Raya',
          distanceKm: 160,
          travelMinutes: 210,
          mobilityNeeds: ['kursi roda'],
        },
        requiresEscort: true,
        escort: {
          pseudonym: `Pendamping ${label}`,
          relation: 'anak',
          windows: windows.map((localDate) => ({ localDate, fromLocal: '05:00', toLocal: '20:00' })),
        },
        documents: verifiedReferral(s),
        scenario: '3',
      };
    },
  },
  '4': {
    id: '4',
    title: 'Poli penuh di hari lab',
    short: '2 hari berurutan dengan menginap, dibandingkan 2 perjalanan terpisah.',
    build: (s, label) => {
      const { busyPoli, busyLab } = specialDays(s);
      return {
        ...base(s),
        earliestDate: busyPoli,
        latestDate: busyLab,
        title: 'Pemeriksaan lab dan konsultasi (jadwal padat)',
        patient: {
          pseudonym: label,
          originRegency: 'Kota Pesisir Jaya',
          distanceKm: 300,
          travelMinutes: 360,
          mobilityNeeds: [],
        },
        requiresEscort: false,
        documents: verifiedReferral(s),
        scenario: '4',
      };
    },
  },
  '5': {
    id: '5',
    title: 'Prioritas klinis berubah',
    short: 'Semua jadwal yang ditahan dilepas, lalu disusun ulang.',
    build: (s, label) => ({
      ...base(s),
      title: 'Kontrol rutin penyakit dalam',
      patient: {
        pseudonym: label,
        originRegency: 'Kab. Tanjung Asri',
        distanceKm: 210,
        travelMinutes: 270,
        mobilityNeeds: [],
      },
      requiresEscort: false,
      documents: [{ kind: 'surat_rujukan', label: 'Surat rujukan' }],
      scenario: '5',
    }),
  },
};
