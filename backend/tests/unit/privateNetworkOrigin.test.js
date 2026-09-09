import { describe, expect, test } from '@jest/globals';

import { isPrivateNetworkOrigin } from '../../src/utils/privateNetworkOrigin.js';

describe('isPrivateNetworkOrigin', () => {
  test('allows loopback and LAN SPA origins', () => {
    expect(isPrivateNetworkOrigin('https://localhost:5190')).toBe(true);
    expect(isPrivateNetworkOrigin('http://127.0.0.1:5190')).toBe(true);
    expect(isPrivateNetworkOrigin('https://192.168.1.114:5190')).toBe(true);
    expect(isPrivateNetworkOrigin('http://10.0.0.5:5190')).toBe(true);
    expect(isPrivateNetworkOrigin('https://172.16.4.2:3000')).toBe(true);
  });

  test('rejects public hosts', () => {
    expect(isPrivateNetworkOrigin('https://example.com')).toBe(false);
    expect(isPrivateNetworkOrigin('https://172.32.0.1:5190')).toBe(false);
    expect(isPrivateNetworkOrigin('not-a-url')).toBe(false);
  });
});
