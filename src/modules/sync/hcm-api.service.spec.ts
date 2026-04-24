import { HcmApiService } from '../hcm/hcm-api.service';

/**
 * Sync module references the shared HCM API client; this spec guards that contract.
 */
describe('HcmApiService (sync module view)', () => {
  it('exports the client used by SyncService', () => {
    expect(HcmApiService).toBeDefined();
  });
});
