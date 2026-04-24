/**
 * Shared mock HCM types.
 */
export interface MockEmployee {
  employeeId: string;
  locationId: string;
  name: string;
}

export interface MockBalanceRecord {
  employeeId: string;
  locationId: string;
  leaveType: string;
  balance: number;
  version: string;
}

export interface RequestLog {
  ts: string;
  method: string;
  path: string;
  durationMs: number;
  status: number;
}
