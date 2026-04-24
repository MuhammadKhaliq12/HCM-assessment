import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import express from 'express';

/** Load repo-root `.env` so mock uses same `HCM_WEBHOOK_SECRET` / URLs as the main app when run locally. */
const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv });
}
import { attachMockHcmRoutes } from './http';
import { HcmStore } from './hcm.store';

/**
 * Standalone mock HCM process entrypoint.
 */
const app = express();
const store = new HcmStore();

app.use(express.json());

attachMockHcmRoutes(app, store, { injectFailures: process.env.MOCK_HCM_INJECT_FAILURES !== 'false' });

store.startDriftTimer();

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-hcm] listening on :${port}`);
});
