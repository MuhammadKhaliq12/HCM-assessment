import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InsufficientBalanceException } from '../../common/exceptions/insufficient-balance.exception';
import { InvalidDimensionsException } from '../../common/exceptions/invalid-dimensions.exception';
import { BalanceSyncLogEntity } from '../../db/entities/balance-sync-log.entity';
import { EmployeeEntity } from '../../db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { TimeOffRequestEntity } from '../../db/entities/timeoff-request.entity';
import { HcmApiService } from '../hcm/hcm-api.service';
import { CreateTimeoffRequestDto } from './dto/create-timeoff-request.dto';
import { TimeoffRequestResponseDto } from './dto/timeoff-request-response.dto';

/** Pending manager approval before HCM commit. */
export const STATUS_PENDING_MANAGER = 'PENDING_MANAGER';

/**
 * Core time-off workflows: employee submission, manager gate, HCM integration.
 */
@Injectable()
export class TimeoffService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TimeOffRequestEntity)
    private readonly requestRepo: Repository<TimeOffRequestEntity>,
    @InjectRepository(TimeOffBalanceEntity)
    private readonly balanceRepo: Repository<TimeOffBalanceEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeeRepo: Repository<EmployeeEntity>,
    @InjectRepository(BalanceSyncLogEntity)
    private readonly syncLogRepo: Repository<BalanceSyncLogEntity>,
    private readonly hcmApi: HcmApiService,
  ) {}

  /**
   * Employee submits a request (defensive local checks, no HCM call until manager approves).
   */
  async requestTimeOff(payload: CreateTimeoffRequestDto): Promise<TimeoffRequestResponseDto> {
    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date range.');
    }
    if (start > end) {
      throw new BadRequestException('startDate must be on or before endDate.');
    }

    const leaveType = (payload.leaveType ?? 'ANNUAL').toUpperCase();

    const employee = await this.employeeRepo.findOne({
      where: { employeeId: payload.employeeId, locationId: payload.locationId },
    });
    if (!employee) {
      throw new InvalidDimensionsException('Employee is not valid for the provided location.');
    }

    const balance = await this.balanceRepo.findOne({
      where: {
        employeeId: payload.employeeId,
        locationId: payload.locationId,
        type: leaveType,
      },
    });

    if (!balance) {
      throw new InvalidDimensionsException('No balance record for employee/location/type.');
    }

    if (balance.days <= 0) {
      throw new InsufficientBalanceException('Negative or zero balance blocks new requests.');
    }

    if (balance.days < payload.days) {
      throw new InsufficientBalanceException();
    }

    const request = this.requestRepo.create({
      employeeId: payload.employeeId,
      locationId: payload.locationId,
      leaveType,
      startDate: payload.startDate,
      endDate: payload.endDate,
      days: payload.days,
      status: STATUS_PENDING_MANAGER,
      requestedAt: new Date(),
    });

    const saved = await this.requestRepo.save(request);
    return this.toResponse(saved);
  }

  /**
   * Manager approves a pending request: re-validates locally, commits to HCM, updates balances.
   */
  async managerApproveRequest(requestId: number, managerApiKey: string | undefined): Promise<TimeoffRequestResponseDto> {
    this.assertManagerKey(managerApiKey);

    return await this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(TimeOffRequestEntity, { where: { id: requestId } });
      if (!row) {
        throw new NotFoundException('Request not found.');
      }
      if (row.status !== STATUS_PENDING_MANAGER) {
        throw new BadRequestException('Only PENDING_MANAGER requests can be approved.');
      }

      const leaveType = row.leaveType.toUpperCase();
      const locationId = row.locationId ?? '';
      const balance = await manager.findOne(TimeOffBalanceEntity, {
        where: {
          employeeId: row.employeeId,
          locationId,
          type: leaveType,
        },
      });

      if (!balance) {
        throw new InvalidDimensionsException('No balance record for employee/location/type.');
      }

      if (balance.days < row.days) {
        throw new InsufficientBalanceException('Balance changed since submission; insufficient days remaining.');
      }

      const before = balance.days;

      const hcm = await this.hcmApi.createTimeoff({
        employeeId: row.employeeId,
        locationId,
        days: row.days,
        leaveType,
        startDate: row.startDate,
        endDate: row.endDate,
      });

      balance.days = Number(hcm.newBalance.toFixed(2));
      balance.hcmVersion = hcm.version ?? balance.hcmVersion;
      balance.lastSyncedAt = new Date();
      await manager.save(balance);

      row.status = hcm.success ? 'APPROVED' : 'REJECTED';
      const saved = await manager.save(row);

      await manager.save(
        manager.create(BalanceSyncLogEntity, {
          employeeId: row.employeeId,
          before,
          after: balance.days,
          reason: 'TIMEOFF_MANAGER_APPROVED',
          timestamp: new Date(),
        }),
      );

      return this.toResponse(saved);
    });
  }

  /**
   * Manager rejects a pending request (no HCM mutation).
   */
  async managerRejectRequest(
    requestId: number,
    managerApiKey: string | undefined,
    _reason?: string,
  ): Promise<TimeoffRequestResponseDto> {
    this.assertManagerKey(managerApiKey);

    const row = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!row) {
      throw new NotFoundException('Request not found.');
    }
    if (row.status !== STATUS_PENDING_MANAGER) {
      throw new BadRequestException('Only PENDING_MANAGER requests can be rejected.');
    }

    row.status = 'REJECTED';
    const saved = await this.requestRepo.save(row);
    return this.toResponse(saved);
  }

  /**
   * Employee cancels their own pending request.
   */
  async cancelEmployeeRequest(requestId: number, employeeId: string): Promise<void> {
    const row = await this.requestRepo.findOne({ where: { id: requestId, employeeId } });
    if (!row) {
      throw new NotFoundException('Request not found.');
    }
    if (row.status !== STATUS_PENDING_MANAGER) {
      throw new BadRequestException('Only PENDING_MANAGER requests can be cancelled.');
    }
    row.status = 'CANCELLED';
    await this.requestRepo.save(row);
  }

  async listEmployeeRequests(employeeId: string): Promise<TimeoffRequestResponseDto[]> {
    const rows = await this.requestRepo.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toResponse(r));
  }

  /**
   * @deprecated Use {@link cancelEmployeeRequest} via REST; retained for backward-compatible tests.
   */
  async cancelRequest(employeeId: string, requestId: number): Promise<void> {
    await this.cancelEmployeeRequest(requestId, employeeId);
  }

  /**
   * @deprecated Manager flow uses {@link managerApproveRequest}.
   */
  async approveRequest(employeeId: string, requestId: number): Promise<void> {
    const row = await this.requestRepo.findOne({ where: { id: requestId, employeeId } });
    if (!row) {
      throw new NotFoundException('Request not found.');
    }
    await this.managerApproveRequest(requestId, process.env.MANAGER_API_KEY);
  }

  private assertManagerKey(managerApiKey: string | undefined): void {
    const expected = process.env.MANAGER_API_KEY;
    if (!expected) {
      throw new UnauthorizedException('MANAGER_API_KEY is not configured on the server.');
    }
    if (managerApiKey !== expected) {
      throw new UnauthorizedException('Invalid manager API key.');
    }
  }

  private toResponse(entity: TimeOffRequestEntity): TimeoffRequestResponseDto {
    return {
      id: entity.id,
      employeeId: entity.employeeId,
      locationId: entity.locationId ?? undefined,
      leaveType: entity.leaveType,
      startDate: entity.startDate,
      endDate: entity.endDate,
      days: entity.days,
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      requestedAt: entity.requestedAt.toISOString(),
    };
  }
}
