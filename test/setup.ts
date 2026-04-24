/**
 * Global integration test setup (runs once per Jest worker via setupFilesAfterEnv).
 */
import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.HCM_API_KEY = process.env.HCM_API_KEY ?? 'test-hcm-key';
process.env.HCM_WEBHOOK_SECRET = process.env.HCM_WEBHOOK_SECRET ?? 'test-webhook-secret';
process.env.HCM_API_URL = process.env.HCM_API_URL ?? 'http://127.0.0.1:3001';
process.env.MANAGER_API_KEY = process.env.MANAGER_API_KEY ?? 'test-manager-api-key';
