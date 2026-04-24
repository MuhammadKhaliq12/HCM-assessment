import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BatchBalanceIngestDto } from './dto/batch-balance-ingest.dto';
import { BatchBalanceIngestResponseDto } from './dto/batch-balance-ingest-response.dto';
import { ManualSyncResponseDto } from './dto/manual-sync-response.dto';
import { SyncStatusResponseDto } from './dto/sync-status-response.dto';
import { SyncService } from './sync.service';

/**
 * Exposes synchronization endpoints.
 */
@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('manual/:employeeId')
  @ApiOperation({ summary: 'Pull authoritative balance from HCM for one employee × location' })
  @ApiParam({ name: 'employeeId', example: 'EMP001' })
  @ApiQuery({ name: 'locationId', required: true, example: 'USA_HQ' })
  @ApiCreatedResponse({ type: ManualSyncResponseDto })
  async manualSync(
    @Param('employeeId') employeeId: string,
    @Query('locationId') locationId?: string,
  ): Promise<ManualSyncResponseDto> {
    return this.syncService.triggerManualSync(employeeId, locationId);
  }

  @Post('batch')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ingest HCM balance corpus (bulk upsert + audit); optional idempotency key' })
  @ApiBody({ type: BatchBalanceIngestDto })
  @ApiOkResponse({ type: BatchBalanceIngestResponseDto })
  async ingestCorpus(@Body() body: BatchBalanceIngestDto): Promise<BatchBalanceIngestResponseDto> {
    return this.syncService.ingestBalanceCorpus(body);
  }

  @Get('status/:employeeId')
  @ApiOperation({ summary: 'Lightweight sync health for an employee' })
  @ApiParam({ name: 'employeeId', example: 'EMP001' })
  @ApiOkResponse({ type: SyncStatusResponseDto })
  async status(@Param('employeeId') employeeId: string): Promise<SyncStatusResponseDto> {
    return this.syncService.getSyncStatus(employeeId);
  }
}
