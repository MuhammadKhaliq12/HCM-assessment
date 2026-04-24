import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConcurrencyException } from '../../common/exceptions/concurrency.exception';
import { InvalidDimensionsException } from '../../common/exceptions/invalid-dimensions.exception';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { TimeoffBalanceResponseDto } from './dto/timeoff-balance-response.dto';

/**
 * Reads and validates local balance snapshots.
 */
@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(TimeOffBalanceEntity)
    private readonly balanceRepo: Repository<TimeOffBalanceEntity>,
  ) {}

  /**
   * Returns the latest balance for an employee/location/leave type.
   */
  async getBalance(employeeId: string, locationId: string, leaveType = 'ANNUAL'): Promise<TimeoffBalanceResponseDto> {
    const type = leaveType.toUpperCase();
    const balance = await this.balanceRepo.findOne({ where: { employeeId, locationId, type } });
    if (!balance) {
      throw new InvalidDimensionsException('No balance record for employee/location/type.');
    }

    const staleWarning = this.isStale(balance.lastSyncedAt);

    return {
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      type: balance.type,
      days: balance.days,
      lastSyncedAt: balance.lastSyncedAt ? balance.lastSyncedAt.toISOString() : null,
      hcmVersion: balance.hcmVersion,
      staleWarning,
      availableDays: Number((balance.days).toFixed(2)),
    };
  }

  /**
   * Computes available days as remaining balance (used days tracked upstream only in mock).
   */
  computeAvailableDays(totalDays: number, usedDays: number): number {
    return Number((totalDays - usedDays).toFixed(2));
  }

  /**
   * Throws when an optimistic lock token does not match persisted HCM version.
   */
  assertVersionMatch(balance: TimeOffBalanceEntity, expectedVersion?: string | null): void {
    if (!expectedVersion) {
      return;
    }
    if (balance.hcmVersion && balance.hcmVersion !== expectedVersion) {
      throw new ConcurrencyException('HCM version mismatch detected for balance row.');
    }
  }

  private isStale(lastSyncedAt: Date | null): boolean {
    if (!lastSyncedAt) {
      return true;
    }
    const ageMs = Date.now() - lastSyncedAt.getTime();
    return ageMs > 24 * 60 * 60 * 1000;
  }
}
