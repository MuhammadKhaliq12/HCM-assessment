import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the initial SQLite schema for time-off domain tables.
 */
export class InitialSchema1714000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employees" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "employeeId" varchar(50) NOT NULL,
        "locationId" varchar(50) NOT NULL,
        "name" varchar(120) NOT NULL,
        CONSTRAINT "UQ_employees_employee_location" UNIQUE ("employeeId", "locationId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "timeOffBalances" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "employeeId" varchar(50) NOT NULL,
        "locationId" varchar(50) NOT NULL,
        "type" varchar(50) NOT NULL,
        "days" float NOT NULL,
        "lastSyncedAt" datetime,
        "hcmVersion" varchar(100),
        CONSTRAINT "UQ_timeoffbalances_employee_location_type" UNIQUE ("employeeId", "locationId", "type")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "timeOffRequests" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "employeeId" varchar(50) NOT NULL,
        "locationId" varchar(50),
        "leaveType" varchar(50) NOT NULL DEFAULT 'ANNUAL',
        "startDate" date NOT NULL,
        "endDate" date NOT NULL,
        "days" float NOT NULL,
        "status" varchar(30) NOT NULL,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "requestedAt" datetime NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "balanceSyncLogs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "employeeId" varchar(50) NOT NULL,
        "before" float NOT NULL,
        "after" float NOT NULL,
        "reason" varchar(200) NOT NULL,
        "timestamp" datetime NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hcmWebhooks" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "event" varchar(100) NOT NULL,
        "payload" text NOT NULL,
        "externalEventId" varchar(120) UNIQUE,
        "processedAt" datetime
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "corpusIngestLogs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "idempotencyKey" varchar(120) NOT NULL,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "UQ_corpusIngestLogs_key" UNIQUE ("idempotencyKey")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "corpusIngestLogs"');
    await queryRunner.query('DROP TABLE IF EXISTS "hcmWebhooks"');
    await queryRunner.query('DROP TABLE IF EXISTS "balanceSyncLogs"');
    await queryRunner.query('DROP TABLE IF EXISTS "timeOffRequests"');
    await queryRunner.query('DROP TABLE IF EXISTS "timeOffBalances"');
    await queryRunner.query('DROP TABLE IF EXISTS "employees"');
  }
}
