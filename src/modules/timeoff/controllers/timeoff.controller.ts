import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { TimeoffBalanceResponseDto } from '../../balance/dto/timeoff-balance-response.dto';
import { BalanceService } from '../../balance/balance.service';
import { CancelTimeoffRequestDto } from '../dto/cancel-timeoff-request.dto';
import { CreateTimeoffRequestDto } from '../dto/create-timeoff-request.dto';
import { RejectTimeoffRequestDto } from '../dto/reject-timeoff-request.dto';
import { TimeoffRequestResponseDto } from '../dto/timeoff-request-response.dto';
import { TimeoffService } from '../timeoff.service';

/**
 * Exposes time-off request APIs (employee + manager flows).
 */
@ApiTags('timeoff')
@Controller('timeoff')
export class TimeoffController {
  constructor(
    private readonly timeoffService: TimeoffService,
    private readonly balanceService: BalanceService,
  ) {}

  @Post('request')
  @HttpCode(201)
  @ApiOperation({ summary: 'Employee submits a time-off request (awaits manager approval)' })
  @ApiCreatedResponse({ type: TimeoffRequestResponseDto })
  @ApiBody({ type: CreateTimeoffRequestDto })
  async requestTimeOff(@Body() payload: CreateTimeoffRequestDto): Promise<TimeoffRequestResponseDto> {
    return this.timeoffService.requestTimeOff(payload);
  }

  @Get('requests/:employeeId')
  @ApiOperation({ summary: 'List time-off requests for an employee' })
  @ApiOkResponse({ type: [TimeoffRequestResponseDto] })
  @ApiParam({ name: 'employeeId', example: 'EMP001' })
  async listRequests(@Param('employeeId') employeeId: string): Promise<TimeoffRequestResponseDto[]> {
    return this.timeoffService.listEmployeeRequests(employeeId);
  }

  @Get('balance/:employeeId/:locationId')
  @ApiOperation({ summary: 'Get cached balance for employee × location (default leave type ANNUAL)' })
  @ApiOkResponse({ type: TimeoffBalanceResponseDto })
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ): Promise<TimeoffBalanceResponseDto> {
    return this.balanceService.getBalance(employeeId, locationId);
  }

  @Post('requests/:requestId/approve')
  @HttpCode(200)
  @ApiSecurity('manager-api-key')
  @ApiOperation({ summary: 'Manager approves a PENDING_MANAGER request (commits to HCM)' })
  @ApiHeader({ name: 'x-manager-api-key', required: true, description: 'Must match MANAGER_API_KEY env' })
  @ApiParam({ name: 'requestId', example: 1 })
  @ApiOkResponse({ type: TimeoffRequestResponseDto })
  async managerApprove(
    @Param('requestId') requestId: string,
    @Headers('x-manager-api-key') managerKey?: string,
  ): Promise<TimeoffRequestResponseDto> {
    return this.timeoffService.managerApproveRequest(Number(requestId), managerKey);
  }

  @Post('requests/:requestId/reject')
  @HttpCode(200)
  @ApiSecurity('manager-api-key')
  @ApiOperation({ summary: 'Manager rejects a PENDING_MANAGER request' })
  @ApiHeader({ name: 'x-manager-api-key', required: true })
  @ApiParam({ name: 'requestId', example: 1 })
  @ApiBody({ type: RejectTimeoffRequestDto, required: false })
  @ApiOkResponse({ type: TimeoffRequestResponseDto })
  async managerReject(
    @Param('requestId') requestId: string,
    @Headers('x-manager-api-key') managerKey?: string,
    @Body() body?: RejectTimeoffRequestDto,
  ): Promise<TimeoffRequestResponseDto> {
    return this.timeoffService.managerRejectRequest(Number(requestId), managerKey, body?.reason);
  }

  @Post('requests/:requestId/cancel')
  @HttpCode(204)
  @ApiOperation({ summary: 'Employee cancels their own PENDING_MANAGER request' })
  @ApiParam({ name: 'requestId', example: 1 })
  @ApiBody({ type: CancelTimeoffRequestDto })
  async cancelRequest(
    @Param('requestId') requestId: string,
    @Body() body: CancelTimeoffRequestDto,
  ): Promise<void> {
    await this.timeoffService.cancelEmployeeRequest(Number(requestId), body.employeeId);
  }
}
