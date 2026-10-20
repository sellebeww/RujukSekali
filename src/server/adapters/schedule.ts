// Port to the hospital scheduling system (SIMRS). The MVP ships a mock; a real adapter must keep the contract:
// every call is time-bounded, and anything other than a definite "ok" is treated as failure (fail-safe).

export type AdapterResult =
  { ok: true } | { ok: false; uncertain: boolean; slotId?: string; message: string };

export interface ScheduleAdapter {
  reserve(slotIds: string[], holdId: string): Promise<AdapterResult>;
  release(slotIds: string[], holdId: string): Promise<AdapterResult>;
  commit(slotIds: string[], planId: string): Promise<AdapterResult>;
}

export interface MockFaults {
  /** Reserve fails for this slot (definite failure). */
  failReserveOn?: (slotId: string) => boolean;
  /** Reserve hangs past the timeout for this slot (uncertain). */
  hangReserveOn?: (slotId: string) => boolean;
  failCommit?: boolean;
  timeoutMs?: number;
}

export class MockScheduleAdapter implements ScheduleAdapter {
  readonly reserved = new Map<string, string>();
  readonly calls: { op: string; slotId: string }[] = [];

  constructor(private faults: MockFaults = {}) {}

  setFaults(f: MockFaults) {
    this.faults = f;
  }

  private withTimeout(p: Promise<AdapterResult>, slotId: string): Promise<AdapterResult> {
    const ms = this.faults.timeoutMs ?? 2000;
    return Promise.race([
      p,
      new Promise<AdapterResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: false,
              uncertain: true,
              slotId,
              message: 'Sistem rumah sakit tidak merespons tepat waktu.',
            }),
          ms,
        ),
      ),
    ]);
  }

  async reserve(slotIds: string[], holdId: string): Promise<AdapterResult> {
    for (const slotId of slotIds) {
      this.calls.push({ op: 'reserve', slotId });
      const res = await this.withTimeout(
        new Promise<AdapterResult>((resolve) => {
          if (this.faults.hangReserveOn?.(slotId)) return; // never resolves -> timeout
          if (this.faults.failReserveOn?.(slotId)) {
            resolve({
              ok: false,
              uncertain: false,
              slotId,
              message: 'Sistem rumah sakit menolak penahanan jadwal.',
            });
            return;
          }
          this.reserved.set(slotId, holdId);
          resolve({ ok: true });
        }),
        slotId,
      );
      if (!res.ok) return res;
    }
    return { ok: true };
  }

  async release(slotIds: string[], holdId: string): Promise<AdapterResult> {
    for (const slotId of slotIds) {
      this.calls.push({ op: 'release', slotId });
      if (this.reserved.get(slotId) === holdId) this.reserved.delete(slotId);
    }
    return { ok: true };
  }

  async commit(slotIds: string[]): Promise<AdapterResult> {
    for (const slotId of slotIds) this.calls.push({ op: 'commit', slotId });
    if (this.faults.failCommit)
      return { ok: false, uncertain: true, message: 'Konfirmasi ke sistem rumah sakit belum pasti.' };
    return { ok: true };
  }
}
