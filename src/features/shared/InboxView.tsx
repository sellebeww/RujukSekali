import { Badge, Notice } from '@/components/ui';
import { formatLocalDateTime } from '@/lib/time';
import type { outbox } from '@/server/db/schema';

type Msg = typeof outbox.$inferSelect;

export function InboxView({ messages }: { messages: Msg[] }) {
  return (
    <div className="container-page py-8">
      <p className="text-sm font-semibold tracking-wide text-clay uppercase">Kotak masuk simulasi</p>
      <h1 className="text-3xl sm:text-4xl">Notifikasi yang &ldquo;terkirim&rdquo;</h1>
      <div className="mt-4 max-w-3xl">
        <Notice tone="teal">
          Tidak ada WhatsApp/SMS sungguhan. Isi pesan sengaja hanya memuat waktu, tempat, dan instruksi umum —
          tanpa nama layanan atau detail klinis.
        </Notice>
      </div>
      {messages.length === 0 ? (
        <p className="mt-6 text-ink-soft">Belum ada notifikasi.</p>
      ) : (
        <ul className="mt-6 grid gap-3 lg:grid-cols-2">
          {messages.map((m) => (
            <li key={m.id} className="ticket p-4" data-testid="inbox-message">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={m.recipientRef.startsWith('pasien') ? 'teal' : 'clay'}>
                  {m.recipientRef.startsWith('pasien')
                    ? 'Ke pasien'
                    : m.recipientRef === 'system_admin'
                      ? 'Ke admin'
                      : 'Ke koordinator'}
                </Badge>
                <span className="text-muted">{formatLocalDateTime(m.createdAt.getTime())} WIB</span>
              </div>
              <p className="mt-2 font-semibold">{m.subject}</p>
              <p className="mt-1 text-[0.95rem] whitespace-pre-line text-ink-soft">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
