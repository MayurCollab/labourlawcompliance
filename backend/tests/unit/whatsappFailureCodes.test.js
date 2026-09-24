import { describe, expect, test } from '@jest/globals';

import {
  classifyFailureCode,
  classifyFailureText,
  nextRetryDelayMs,
  parseFailureCode,
  toUserFacingStatus,
  userFacingErrorMessage,
  WHATSAPP_FAILURE_CATEGORIES,
} from '../../src/modules/whatsappSends/whatsappFailureCodes.js';

describe('parseFailureCode', () => {
  test('extracts the leading numeric code from an MSG91 reason string', () => {
    expect(
      parseFailureCode(
        '131049: This message was not delivered to maintain healthy ecosystem engagement.',
      ),
    ).toBe('131049');
  });

  test('extracts the code even when wrapped in extra formatting', () => {
    expect(
      parseFailureCode('MSG91 WhatsApp send failed (470): 131049: some detail'),
    ).toBe('131049');
  });

  test('returns null when no code is present', () => {
    expect(parseFailureCode('Network timeout')).toBeNull();
    expect(parseFailureCode(null)).toBeNull();
    expect(parseFailureCode(undefined)).toBeNull();
  });
});

describe('classifyFailureCode', () => {
  test.each([
    ['131050', WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT],
    ['131049', WHATSAPP_FAILURE_CATEGORIES.LONG_BACKOFF_RETRY],
    ['131056', WHATSAPP_FAILURE_CATEGORIES.SHORT_BACKOFF_RETRY],
    ['130429', WHATSAPP_FAILURE_CATEGORIES.SHORT_BACKOFF_RETRY],
    ['131048', WHATSAPP_FAILURE_CATEGORIES.QUALITY_THROTTLE],
    ['131026', WHATSAPP_FAILURE_CATEGORIES.UNDELIVERABLE_FALLBACK],
    ['999999', WHATSAPP_FAILURE_CATEGORIES.OTHER],
    [null, WHATSAPP_FAILURE_CATEGORIES.OTHER],
  ])('classifies %s as %s', (code, expected) => {
    expect(classifyFailureCode(code)).toBe(expected);
  });
});

describe('classifyFailureText', () => {
  test('parses + classifies in one call', () => {
    expect(
      classifyFailureText('131050: user opted out of marketing messages'),
    ).toEqual({ code: '131050', category: WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT });
  });
});

describe('nextRetryDelayMs', () => {
  test('long_backoff_retry starts at >= 24h and increases', () => {
    const category = WHATSAPP_FAILURE_CATEGORIES.LONG_BACKOFF_RETRY;
    const first = nextRetryDelayMs(category, 0);
    const second = nextRetryDelayMs(category, 1);
    expect(first).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
    expect(second).toBeGreaterThan(first);
  });

  test('short_backoff_retry uses short delays', () => {
    const category = WHATSAPP_FAILURE_CATEGORIES.SHORT_BACKOFF_RETRY;
    expect(nextRetryDelayMs(category, 0)).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  test('returns null once max attempts are exhausted', () => {
    const category = WHATSAPP_FAILURE_CATEGORIES.SHORT_BACKOFF_RETRY;
    expect(nextRetryDelayMs(category, 3)).toBeNull();
  });

  test('never-retry categories always return null', () => {
    expect(
      nextRetryDelayMs(WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT, 0),
    ).toBeNull();
    expect(
      nextRetryDelayMs(WHATSAPP_FAILURE_CATEGORIES.QUALITY_THROTTLE, 0),
    ).toBeNull();
    expect(
      nextRetryDelayMs(WHATSAPP_FAILURE_CATEGORIES.UNDELIVERABLE_FALLBACK, 0),
    ).toBeNull();
  });
});

describe('userFacingErrorMessage', () => {
  test('never includes the raw code or Meta wording', () => {
    const message = userFacingErrorMessage(
      '131049: This message was not delivered to maintain healthy ecosystem engagement.',
    );
    expect(message).not.toContain('131049');
    expect(message).not.toMatch(/ecosystem/i);
  });

  test('returns null for unrecognized errors so callers keep their own fallback', () => {
    expect(userFacingErrorMessage('Network timeout')).toBeNull();
  });
});

describe('toUserFacingStatus', () => {
  test('maps delivered/read/accepted straight through', () => {
    expect(toUserFacingStatus({ status: 'read' })).toBe('read');
    expect(toUserFacingStatus({ status: 'delivered' })).toBe('delivered');
    expect(toUserFacingStatus({ status: 'accepted' })).toBe('delivering');
  });

  test('opted-out and unreachable failures map to their own plain statuses', () => {
    expect(
      toUserFacingStatus({
        status: 'failed',
        failureCategory: WHATSAPP_FAILURE_CATEGORIES.PERMANENT_OPT_OUT,
      }),
    ).toBe('opted_out');
    expect(
      toUserFacingStatus({
        status: 'failed',
        failureCategory: WHATSAPP_FAILURE_CATEGORIES.UNDELIVERABLE_FALLBACK,
      }),
    ).toBe('unreachable');
  });

  test('a scheduled retry reads as "we\'ll retry shortly"', () => {
    expect(
      toUserFacingStatus({
        status: 'failed',
        failureCategory: WHATSAPP_FAILURE_CATEGORIES.LONG_BACKOFF_RETRY,
        retryState: 'scheduled',
      }),
    ).toBe('retry_scheduled');
  });

  test('exhausted/other failures fall back to needs_review', () => {
    expect(
      toUserFacingStatus({
        status: 'failed',
        failureCategory: WHATSAPP_FAILURE_CATEGORIES.QUALITY_THROTTLE,
        retryState: 'exhausted',
      }),
    ).toBe('needs_review');
  });
});
