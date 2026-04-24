import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds corpus ingest idempotency table for HCM → ReadyOn bulk balance pushes.
 */
export class AddCorpusIngestLogs1714000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }
}
