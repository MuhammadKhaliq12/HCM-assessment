import { createHmac } from 'crypto';
import { MockBalanceRecord, MockEmployee, RequestLog } from './types';

/**
 * In-memory authoritative HCM state with drift + webhook fan-out.
 */
export class HcmStore {
  private readonly employees = new Map<string, MockEmployee>();
  private readonly balances = new Map<string, MockBalanceRecord>();
  private readonly logs: RequestLog[] = [];
  private readonly startedAt = Date.now();

  constructor() {
    this.seed();
  }

  reset(): void {
    this.employees.clear();
    this.balances.clear();
    this.logs.length = 0;
    this.seed();
  }

  health(): { status: string; uptime: number } {
    return { status: 'ok', uptime: Math.floor((Date.now() - this.startedAt) / 1000) };
  }

  getLogs(): RequestLog[] {
    return [...this.logs];
  }

  getBalance(employeeId: string, locationId: string, leaveType = 'ANNUAL'): MockBalanceRecord {
    const key = this.balanceKey(employeeId, locationId, leaveType);
    const existing = this.balances.get(key);
    if (existing) {
      return { ...existing };
    }

    if (!this.employees.has(this.employeeKey(employeeId, locationId))) {
      throw Object.assign(new Error('INVALID_EMPLOYEE'), { code: 'INVALID_EMPLOYEE' });
    }

    const created: MockBalanceRecord = {
      employeeId,
      locationId,
      leaveType: leaveType.toUpperCase(),
      balance: 10,
      version: this.newVersion(),
    };
    this.balances.set(key, created);
    return { ...created };
  }

  createTimeOff(input: {
    employeeId: string;
    locationId: string;
    days: number;
    leaveType?: string;
  }): { success: boolean; newBalance: number; hcmRefId: string; version: string } {
    const leaveType = (input.leaveType ?? 'ANNUAL').toUpperCase();
    const record = this.getBalance(input.employeeId, input.locationId, leaveType);

    if (record.balance < input.days) {
      throw Object.assign(new Error('INSUFFICIENT_BALANCE'), { code: 'INSUFFICIENT_BALANCE' });
    }

    record.balance = Number((record.balance - input.days).toFixed(2));
    record.version = this.newVersion();
    this.balances.set(this.balanceKey(record.employeeId, record.locationId, record.leaveType), record);

    void this.notifyReadyOn('balance.updated', {
      employeeId: record.employeeId,
      locationId: record.locationId,
      leaveType: record.leaveType,
      balance: record.balance,
      version: record.version,
    });

    return {
      success: true,
      newBalance: record.balance,
      hcmRefId: `HCM-${Date.now()}`,
      version: record.version,
    };
  }

  batchSync(records: Array<{ employeeId: string; locationId: string; balance?: number; leaveType?: string }>): {
    synced: MockBalanceRecord[];
    errors: Array<{ employeeId: string; locationId: string; message: string }>;
  } {
    const synced: MockBalanceRecord[] = [];
    const errors: Array<{ employeeId: string; locationId: string; message: string }> = [];

    for (const r of records) {
      try {
        const leaveType = (r.leaveType ?? 'ANNUAL').toUpperCase();
        const current = this.getBalance(r.employeeId, r.locationId, leaveType);
        if (typeof r.balance === 'number') {
          current.balance = Number(r.balance.toFixed(2));
          current.version = this.newVersion();
          this.balances.set(this.balanceKey(current.employeeId, current.locationId, current.leaveType), current);
        }
        synced.push({ ...current });
      } catch (e) {
        errors.push({ employeeId: r.employeeId, locationId: r.locationId, message: (e as Error).message });
      }
    }

    return { synced, errors };
  }

  refresh(employeeId: string, locationId: string, leaveType = 'ANNUAL'): MockBalanceRecord {
    const record = this.getBalance(employeeId, locationId, leaveType);
    record.version = this.newVersion();
    this.balances.set(this.balanceKey(record.employeeId, record.locationId, record.leaveType), record);
    return { ...record };
  }

  simulateDrift(): MockBalanceRecord {
    const all = Array.from(this.balances.values());
    if (all.length === 0) {
      throw new Error('No balances to drift');
    }
    const pick = all[Math.floor(Math.random() * all.length)];
    const grant = 1 + Math.floor(Math.random() * 3);
    pick.balance = Number((pick.balance + grant).toFixed(2));
    pick.version = this.newVersion();
    this.balances.set(this.balanceKey(pick.employeeId, pick.locationId, pick.leaveType), pick);

    const reason = Math.random() < 0.5 ? 'WORK_ANNIVERSARY' : 'PERIODIC_ADJUSTMENT';
    // eslint-disable-next-line no-console
    console.log(
      `[mock-hcm] drift +${grant} days employee=${pick.employeeId} loc=${pick.locationId} reason=${reason} version=${pick.version}`,
    );

    void this.notifyReadyOn('balance.updated', {
      employeeId: pick.employeeId,
      locationId: pick.locationId,
      leaveType: pick.leaveType,
      balance: pick.balance,
      version: pick.version,
      reason,
    });

    return { ...pick };
  }

  startDriftTimer(): void {
    setInterval(() => {
      try {
        this.simulateDrift();
      } catch {
        // ignore empty state
      }
    }, 60_000);
  }

  logRequest(entry: RequestLog): void {
    this.logs.push(entry);
    if (this.logs.length > 500) {
      this.logs.shift();
    }
  }

  private seed(): void {
    const e1: MockEmployee = { employeeId: 'EMP001', locationId: 'USA_HQ', name: 'John Doe' };
    const e2: MockEmployee = { employeeId: 'EMP002', locationId: 'CANADA_OFFICE', name: 'Jane Smith' };
    this.employees.set(this.employeeKey(e1.employeeId, e1.locationId), e1);
    this.employees.set(this.employeeKey(e2.employeeId, e2.locationId), e2);

    const b1: MockBalanceRecord = {
      employeeId: 'EMP001',
      locationId: 'USA_HQ',
      leaveType: 'ANNUAL',
      balance: 20,
      version: this.newVersion(),
    };
    this.balances.set(this.balanceKey(b1.employeeId, b1.locationId, b1.leaveType), b1);
  }

  private employeeKey(employeeId: string, locationId: string): string {
    return `${employeeId}::${locationId}`;
  }

  private balanceKey(employeeId: string, locationId: string, leaveType: string): string {
    return `${employeeId}::${locationId}::${leaveType.toUpperCase()}`;
  }

  private newVersion(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  private async notifyReadyOn(event: string, data: Record<string, unknown>): Promise<void> {
    const target = process.env.READYON_WEBHOOK_URL;
    if (!target) {
      return;
    }

    const eventId = `${event}:${data.version}:${Math.random().toString(16).slice(2)}`;

    const secret = process.env.HCM_WEBHOOK_SECRET ?? '';
    const signature = secret ? createHmac('sha256', secret).update(`${event}:${eventId}`).digest('hex') : '';

    try {
      await fetch(target, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(signature ? { 'x-hcm-signature': signature } : {}),
        },
        body: JSON.stringify({ event, eventId, payload: data }),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[mock-hcm] webhook delivery failed', (e as Error).message);
    }
  }
}
