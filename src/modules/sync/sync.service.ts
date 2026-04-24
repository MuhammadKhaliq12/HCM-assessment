import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HCMSyncException } from '../../common/exceptions/hcm-sync.exception';
import { BalanceSyncLogEntity } from '../../db/entities/balance-sync-log.entity';
import { CorpusIngestLogEntity } from '../../db/entities/corpus-ingest-log.entity';
import { EmployeeEntity } from '../../db/entities/employee.entity';
import { TimeOffBalanceEntity } from '../../db/entities/timeoff-balance.entity';
import { HcmApiService } from '../hcm/hcm-api.service';
import { BatchBalanceIngestDto } from './dto/batch-balance-ingest.dto';
import { BatchBalanceIngestResponseDto } from './dto/batch-balance-ingest-response.dto';
import { ManualSyncResponseDto } from './dto/manual-sync-response.dto';
import { SyncStatusResponseDto } from './dto/sync-status-response.dto';

/**
 * Sync orchestration: manual pulls from HCM, inbound corpus ingest, reconciliation helpers.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly queue: Array<{ employeeId: string; locationId: string }> = [];

  constructor(
    private readonly dataSource: DataSource,
    private readonly hcmApi: HcmApiService,
    @InjectRepository(TimeOffBalanceEntity)
    private readonly balanceRepo: Repository<TimeOffBalanceEntity>,
    @InjectRepository(BalanceSyncLogEntity)
    private readonly syncLogRepo: Repository<BalanceSyncLogEntity>,
    @InjectRepository(CorpusIngestLogEntity)
    private readonly corpusRepo: Repository<CorpusIngestLogEntity>,
  ) {}

  /**
   * Triggers a manual sync for a single employee/location pair.
   */
  async triggerManualSync(employeeId: string, locationId?: string): Promise<ManualSyncResponseDto> {
    this.logger.log(`Manual sync requested employee=${employeeId} location=${locationId ?? 'n/a'}`);

    if (!locationId) {
      return {
        employeeId,
        queued: false,
        message: 'locationId query parameter is required for manual sync.',
      };
    }

    const remote = await this.hcmApi.getBalance(employeeId, locationId);
    const leaveType = (remote.leaveType ?? 'ANNUAL').toUpperCase();

    let balance = await this.balanceRepo.findOne({
      where: { employeeId, locationId, type: leaveType },
    });

    const before = balance?.days ?? 0;
    const after = remote.balance;
    const reason = before !== after ? 'HCM_CORRECTION' : 'MANUAL_SYNC';

    if (!balance) {
      balance = this.balanceRepo.create({
        employeeId,
        locationId,
        type: leaveType,
        days: after,
        lastSyncedAt: new Date(),
        hcmVersion: remote.version,
      });
    } else {
      balance.days = after;
      balance.hcmVersion = remote.version;
      balance.lastSyncedAt = new Date();
    }

    await this.balanceRepo.save(balance);

    await this.syncLogRepo.save(
      this.syncLogRepo.create({
        employeeId,
        before,
        after,
        reason,
        timestamp: new Date(),
      }),
    );

    return { employeeId, queued: false, message: `Manual sync completed (${reason}).` };
  }

  /**
   * Ingests a full or partial balance corpus from HCM (HCM → ReadyOn).
   * Idempotency key is persisted only when every row succeeds (no partial key commits).
   */
  async ingestBalanceCorpus(dto: BatchBalanceIngestDto): Promise<BatchBalanceIngestResponseDto> {
    const key = dto.idempotencyKey?.trim();
    if (key) {
      const existing = await this.corpusRepo.findOne({ where: { idempotencyKey: key } });
      if (existing) {
        return {
          applied: 0,
          errors: [],
          idempotentReplay: true,
          message: 'Idempotent replay: this corpus batch was already applied.',
        };
      }
    }

    const errors: Array<{ index: number; employeeId?: string; message: string }> = [];
    let applied = 0;

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < dto.balances.length; i += 1) {
        const row = dto.balances[i];
        const employee = await manager.findOne(EmployeeEntity, {
          where: { employeeId: row.employeeId, locationId: row.locationId },
        });
        if (!employee) {
          errors.push({ index: i, employeeId: row.employeeId, message: 'Unknown employee/location dimensions.' });
          continue;
        }

        const leaveType = row.leaveType.toUpperCase();
        let balance = await manager.findOne(TimeOffBalanceEntity, {
          where: { employeeId: row.employeeId, locationId: row.locationId, type: leaveType },
        });

        const before = balance?.days ?? 0;
        const after = Number(row.days);

        if (!balance) {
          balance = manager.create(TimeOffBalanceEntity, {
            employeeId: row.employeeId,
            locationId: row.locationId,
            type: leaveType,
            days: after,
            lastSyncedAt: new Date(),
            hcmVersion: row.version ?? null,
          });
        } else {
          balance.days = after;
          balance.lastSyncedAt = new Date();
          if (row.version) {
            balance.hcmVersion = row.version;
          }
        }

        await manager.save(balance);
        await manager.save(
          manager.create(BalanceSyncLogEntity, {
            employeeId: row.employeeId,
            before,
            after,
            reason: 'HCM_CORPUS_INGEST',
            timestamp: new Date(),
          }),
        );
        applied += 1;
      }

      if (key && errors.length === 0) {
        await manager.save(manager.create(CorpusIngestLogEntity, { idempotencyKey: key }));
      }
    });

    return {
      applied,
      errors,
      idempotentReplay: false,
      message:
        errors.length > 0
          ? `Partial success: ${applied} row(s) applied, ${errors.length} row(s) failed. Idempotency key not stored — fix and retry with a new key if needed.`
          : `Corpus ingest completed: ${applied} row(s).`,
    };
  }

  /**
   * Reconciles local balance with HCM (HCM wins on numeric conflict).
   */
  async reconcileWithHcmWins(employeeId: string, locationId: string, leaveType = 'ANNUAL'): Promise<void> {
    const remote = await this.hcmApi.getBalance(employeeId, locationId, leaveType);
    let local = await this.balanceRepo.findOne({
      where: { employeeId, locationId, type: leaveType.toUpperCase() },
    });

    const before = local?.days ?? 0;
    const after = remote.balance;

    if (!local) {
      local = this.balanceRepo.create({
        employeeId,
        locationId,
        type: leaveType.toUpperCase(),
        days: after,
        lastSyncedAt: new Date(),
        hcmVersion: remote.version,
      });
    } else {
      local.days = after;
      local.hcmVersion = remote.version;
      local.lastSyncedAt = new Date();
    }

    await this.balanceRepo.save(local);
    await this.syncLogRepo.save(
      this.syncLogRepo.create({
        employeeId,
        before,
        after,
        reason: 'HCM_RECONCILIATION',
        timestamp: new Date(),
      }),
    );
  }

  enqueueSync(employeeId: string, locationId: string): void {
    this.queue.push({ employeeId, locationId });
  }

  async processNextInQueue(): Promise<boolean> {
    const next = this.queue.shift();
    if (!next) {
      return false;
    }
    await this.triggerManualSync(next.employeeId, next.locationId);
    return true;
  }

  async getSyncStatus(employeeId: string): Promise<SyncStatusResponseDto> {
    this.logger.log(`Sync status requested employee=${employeeId}`);
    const balance = await this.balanceRepo.findOne({ where: { employeeId }, order: { lastSyncedAt: 'DESC' } });

    if (!balance) {
      return { employeeId, status: 'unknown', lastSyncedAt: null, lastError: null };
    }

    const stale = !balance.lastSyncedAt || Date.now() - balance.lastSyncedAt.getTime() > 24 * 60 * 60 * 1000;
    return {
      employeeId,
      status: stale ? 'degraded' : 'healthy',
      lastSyncedAt: balance.lastSyncedAt ? balance.lastSyncedAt.toISOString() : null,
      lastError: null,
    };
  }

  async fetchBalanceWithRetry(employeeId: string, locationId: string): Promise<number> {
    try {
      const remote = await this.hcmApi.getBalance(employeeId, locationId);
      return remote.balance;
    } catch (e) {
      this.logger.error('Failed to fetch balance after retries', e as Error);
      throw new HCMSyncException();
    }
  }
}
