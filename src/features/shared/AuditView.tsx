import { AUDIT_LABEL } from '@/content/labels';
import { formatLocalDateTime } from '@/lib/time';
import type { auditLog } from '@/server/db/schema';

export function AuditView({ rows }: { rows: (typeof auditLog.$inferSelect)[] }) {
  return (
    <div className="container-page py-8">
      <p className="text-sm font-semibold tracking-wide text-clay uppercase">Audit log</p>
      <h1 className="text-3xl sm:text-4xl">Siapa, kapan, apa, dan mengapa</h1>
      <p className="mt-2 max-w-3xl text-ink-soft">
        Catatan ini hanya bisa ditambah, tidak bisa diubah atau dihapus (dijaga di level database). Tidak memuat data pribadi atau klinis.
      </p>
      <div className="ticket mt-6 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-[0.95rem]">
          <caption className="sr-only">200 kejadian terakhir</caption>
          <thead className="border-b border-line bg-paper-deep/60 text-sm">
            <tr>
              <th className="px-3 py-2">Waktu (WIB)</th>
              <th className="px-3 py-2">Pelaku</th>
              <th className="px-3 py-2">Kejadian</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Alasan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 align-top">
                <td className="px-3 py-2 whitespace-nowrap">{formatLocalDateTime(r.at.getTime())}</td>
                <td className="px-3 py-2">{r.actorLabel ?? r.actorType}</td>
                <td className="px-3 py-2">
                  {AUDIT_LABEL[r.action] ?? r.action} <span className="text-sm text-muted">({r.entity})</span>
                </td>
                <td className="px-3 py-2 font-mono text-sm">{r.fromState || r.toState ? `${r.fromState ?? '—'} → ${r.toState ?? '—'}` : ''}</td>
                <td className="px-3 py-2">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
