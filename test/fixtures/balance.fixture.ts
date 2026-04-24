import { DataSource } from 'typeorm';
import { EmployeeEntity } from '../../src/db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../src/db/entities/timeoff-balance.entity';

/**
 * Static balance fixtures for tests.
 */
export const testBalances = {
  annual: {
    totalDays: 20,
    usedDays: 3,
    leaveType: 'ANNUAL',
  },
  sick: {
    totalDays: 10,
    usedDays: 0,
    leaveType: 'SICK',
  },
};

/**
 * Persists a balance row for a given employee fixture.
 */
export async function createTestBalance(
  ds: DataSource,
  employee: EmployeeEntity,
  overrides: Partial<TimeOffBalanceEntity> = {},
): Promise<TimeOffBalanceEntity> {
  const repo = ds.getRepository(TimeOffBalanceEntity);
  const leaveType = (overrides.type ?? testBalances.annual.leaveType).toUpperCase();
  const available = testBalances.annual.totalDays - testBalances.annual.usedDays;
  const balance = repo.create({
    employeeId: employee.employeeId,
    locationId: employee.locationId,
    type: leaveType,
    days: overrides.days ?? available,
    lastSyncedAt: overrides.lastSyncedAt ?? new Date(),
    hcmVersion: overrides.hcmVersion ?? 'v-test-1',
    ...overrides,
  });
  return repo.save(balance);
}
