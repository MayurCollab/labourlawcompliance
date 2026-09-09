import { afterEach, describe, expect, it, vi } from 'vitest';

import { canPickDownloadFolder, downloadFilesToFolder } from './folderDownload';

vi.mock('@/utils/download', () => ({
  saveBlob: vi.fn(),
}));

describe('canPickDownloadFolder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false outside a secure context', () => {
    vi.stubGlobal('window', {
      isSecureContext: false,
      showDirectoryPicker: vi.fn(),
    });
    expect(canPickDownloadFolder()).toBe(false);
  });

  it('is true when secure and picker exists', () => {
    vi.stubGlobal('window', {
      isSecureContext: true,
      showDirectoryPicker: vi.fn(),
    });
    expect(canPickDownloadFolder()).toBe(true);
  });
});

describe('downloadFilesToFolder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('falls back to a ZIP when folder picker is unavailable', async () => {
    const { saveBlob } = await import('@/utils/download');
    vi.stubGlobal('window', {
      isSecureContext: false,
      setTimeout: globalThis.setTimeout.bind(globalThis),
    });

    const result = await downloadFilesToFolder([
      {
        id: '1',
        filename: 'a.pdf',
        getBlob: async () =>
          ({
            arrayBuffer: async () => new TextEncoder().encode('pdf-a'),
          }) as unknown as Blob,
      },
      {
        id: '2',
        filename: 'b.pdf',
        getBlob: async () =>
          ({
            arrayBuffer: async () => new TextEncoder().encode('pdf-b'),
          }) as unknown as Blob,
      },
    ]);

    expect(result).toEqual({ mode: 'zip', saved: 2 });
    expect(saveBlob).toHaveBeenCalledTimes(1);
    const [blob, name] = vi.mocked(saveBlob).mock.calls[0]!;
    expect(name).toMatch(/^Form5_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/zip');
  });
});
