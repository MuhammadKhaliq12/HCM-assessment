/**
 * Example upstream HCM payloads used in unit tests.
 */
export const mockHCMResponses = {
  balanceOK: {
    employeeId: 'EMP001',
    locationId: 'USA_HQ',
    leaveType: 'ANNUAL',
    totalDays: 20,
    usedDays: 3,
    version: '20240120_150000',
  },
  balanceInsufficient: {
    error: 'INSUFFICIENT_BALANCE',
    required: 5,
    available: 2,
  },
  timeoutError: {
    error: 'TIMEOUT',
    message: 'HCM API did not respond within 5s',
  },
};
