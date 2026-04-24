/**
 * Module-level sync log model for future use.
 */
export interface SyncLogModel {
  employeeId: string;
  before: number;
  after: number;
  reason: string;
  timestamp: string;
}
