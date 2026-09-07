import { describe, expect, test } from '@jest/globals';

import {
  createPtSlabSchema,
  updatePtSlabSchema,
} from '../../src/modules/ptSlabs/ptSlabs.validation.js';

describe('ptSlabs validation', () => {
  test('keeps salaryTo null for an open-ended 12,000+ band', () => {
    const created = createPtSlabSchema.parse({
      salaryFrom: 12000,
      salaryTo: null,
      rate: 200,
      effectiveFrom: '2019-04-01',
    });
    expect(created.salaryTo).toBeNull();
    expect(created.salaryFrom).toBe(12000);

    const updated = updatePtSlabSchema.parse({
      salaryFrom: 12000,
      salaryTo: null,
      rate: 200,
      effectiveFrom: '2019-04-01',
    });
    expect(updated.salaryTo).toBeNull();
  });

  test('still coerces a closed-band salaryTo', () => {
    const parsed = updatePtSlabSchema.parse({
      salaryFrom: 9000,
      salaryTo: '11999',
      rate: 150,
    });
    expect(parsed.salaryTo).toBe(11999);
  });
});
