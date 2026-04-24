/**
 * Module-level model shape for time-off request use cases.
 */
export interface TimeoffRequestModel {
  employeeId: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
}
