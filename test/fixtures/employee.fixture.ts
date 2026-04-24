import { DataSource } from 'typeorm';
import { EmployeeEntity } from '../../src/db/entities/employee.entity';

/**
 * Static employee fixtures for tests.
 */
export const testEmployees = {
  emp1: { id: 'EMP001', name: 'John Doe', location: 'USA_HQ' },
  emp2: { id: 'EMP002', name: 'Jane Smith', location: 'CANADA_OFFICE' },
};

/**
 * Persists a test employee row using TypeORM.
 */
export async function createTestEmployee(ds: DataSource, overrides: Partial<EmployeeEntity> = {}): Promise<EmployeeEntity> {
  const repo = ds.getRepository(EmployeeEntity);
  const employee = repo.create({
    employeeId: testEmployees.emp1.id,
    locationId: testEmployees.emp1.location,
    name: testEmployees.emp1.name,
    ...overrides,
  });
  return repo.save(employee);
}
