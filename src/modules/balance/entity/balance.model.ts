/**
 * Module-level balance model for service contracts.
 */
export interface BalanceModel {
  employeeId: string;
  locationId: string;
  type: string;
  days: number;
  hcmVersion: string | null;
}
