import { ActionForm } from '@/components/ActionForm';
import { Badge, inputClass, Notice } from '@/components/ui';
import { formatLocalDate } from '@/lib/time';
import { blockDayAction, serviceRulesAction } from '@/server/actions/admin';
import type { serviceType } from '@/server/db/schema';
import type { capacityOverview } from '@/server/queries';
import { allowedHeld } from '@/server/usecases/planning';

type Row = Awaited<ReturnType<typeof capacityOverview>>[number];

export function AdminUnitView({
  zone,
  services,
  capacity,
}: {
  zone: 'app' | 'demo';
  services: (typeof serviceType.$inferSelect)[];
  capacity: Row[];
}) {
  return (
    <div className="container-page py-8">
      <p className="text-sm font-semibold tracking-wide text-clay uppercase">Admin unit</p>
      <h1 className="text-3xl sm:text-4xl">Kapasitas, aturan persiapan, dan batas penahanan</h1>
      <div className="mt-4 max-w-3xl">
        <Notice tone="ochre">
          Nilai default (puasa sampai 10:00, hasil lab 3 jam, TTL, rasio 30%) adalah asumsi MVP yang{' '}
          <strong>perlu diverifikasi</strong> bersama unit layanan.
        </Notice>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {services.map((s) => (
          <section key={s.id} className="ticket flex flex-col p-5" aria-labelledby={`svc-${s.code}`}>
            <h2 id={`svc-${s.code}`} className="text-2xl">
              {s.name}
            </h2>
            <p className="text-sm text-muted">
              Durasi {s.durationMin} menit{s.fasting ? ' · wajib puasa' : ''}
            </p>
            <ActionForm
              action={serviceRulesAction}
              hidden={{ zone, code: s.code }}
              label="Simpan aturan"
              tone="secondary"
              className="mt-4 flex-1"
            >
              <div className="grid flex-1 grid-cols-2 content-start gap-3 text-sm">
                {s.fasting && (
                  <label className="flex flex-col gap-1 font-semibold">
                    Jam mulai paling lambat (puasa)
                    <input
                      name="latestStartLocal"
                      defaultValue={s.latestStartLocal ?? ''}
                      pattern="\d{2}:\d{2}"
                      className={inputClass}
                    />
                  </label>
                )}
                {!s.fasting && <input type="hidden" name="latestStartLocal" value="" />}
                <label className="flex flex-col gap-1 font-semibold">
                  Hasil siap setelah (menit)
                  <input
                    name="resultReadyMin"
                    type="number"
                    min={0}
                    defaultValue={s.resultReadyMin}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 font-semibold">
                  TTL singkat (menit)
                  <input
                    name="ttlSingkatMin"
                    type="number"
                    min={15}
                    defaultValue={s.holdTtlMinutes.singkat}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 font-semibold">
                  TTL standar (menit)
                  <input
                    name="ttlStandarMin"
                    type="number"
                    min={15}
                    defaultValue={s.holdTtlMinutes.standar}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 font-semibold">
                  TTL panjang (menit)
                  <input
                    name="ttlPanjangMin"
                    type="number"
                    min={15}
                    defaultValue={s.holdTtlMinutes.panjang}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 font-semibold">
                  Rasio maks. slot ditahan (%)
                  <input
                    name="maxHoldRatioPct"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={Math.round(s.maxHoldRatio * 100)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 font-semibold">
                  Batas perpanjangan
                  <input
                    name="maxExtensions"
                    type="number"
                    min={0}
                    max={10}
                    defaultValue={s.maxExtensions}
                    className={inputClass}
                  />
                </label>
              </div>
            </ActionForm>
          </section>
        ))}
      </div>

      {services.map((s) => {
        const rows = capacity.filter((c) => c.serviceTypeId === s.id);
        return (
          <section key={s.id} className="mt-8" aria-labelledby={`cap-${s.code}`}>
            <h2 id={`cap-${s.code}`} className="text-2xl">
              Kapasitas 14 hari: {s.shortName}
            </h2>
            <div className="ticket mt-3 overflow-x-auto">
              <table className="w-full text-left text-[0.95rem] tabular-nums max-sm:block sm:min-w-152">
                <thead className="border-b border-line bg-paper-deep/60 text-sm max-sm:sr-only">
                  <tr>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Kosong</th>
                    <th className="px-3 py-2">Ditahan / batas</th>
                    <th className="px-3 py-2">Terisi</th>
                    <th className="px-3 py-2">Diblokir</th>
                    <th className="px-3 py-2">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="max-sm:block">
                  {rows.map((r) => {
                    const cap = allowedHeld(r.total - r.blocked, r.ratio);
                    // Below sm each row becomes a card: date + action on top, four labelled figures below.
                    const stat = `px-3 py-2 max-sm:flex max-sm:flex-col max-sm:px-0 max-sm:py-0 max-sm:text-base max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:text-muted max-sm:before:content-[attr(data-label)]`;
                    return (
                      <tr
                        key={r.localDate}
                        className="border-b border-line/60 max-sm:grid max-sm:grid-cols-4 max-sm:gap-x-2 max-sm:gap-y-2 max-sm:px-4 max-sm:py-3"
                      >
                        <td className="px-3 py-2 whitespace-nowrap max-sm:col-span-2 max-sm:px-0 max-sm:py-0 max-sm:font-semibold max-sm:self-center">
                          {formatLocalDate(r.localDate)}
                        </td>
                        <td data-label="Kosong" className={`${stat} max-sm:row-start-2`}>
                          {r.available}
                        </td>
                        <td data-label="Ditahan" className={`${stat} max-sm:row-start-2`}>
                          {r.held} / {cap} {r.held >= cap && <Badge tone="danger">penuh</Badge>}
                        </td>
                        <td data-label="Terisi" className={`${stat} max-sm:row-start-2`}>
                          {r.booked}
                        </td>
                        <td data-label="Diblokir" className={`${stat} max-sm:row-start-2`}>
                          {r.blocked}
                        </td>
                        <td className="px-3 py-2 max-sm:col-span-2 max-sm:col-start-3 max-sm:row-start-1 max-sm:justify-self-end max-sm:px-0 max-sm:py-0">
                          <ActionForm
                            action={blockDayAction}
                            hidden={{
                              zone,
                              serviceTypeId: r.serviceTypeId,
                              localDate: r.localDate,
                              op: r.blocked > 0 ? 'unblock' : 'block',
                            }}
                            label={r.blocked > 0 ? 'Buka blokir' : 'Blokir slot kosong'}
                            tone={r.blocked > 0 ? 'secondary' : 'danger'}
                            compact
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
