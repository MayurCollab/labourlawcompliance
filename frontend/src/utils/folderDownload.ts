import { zipSync } from 'fflate';

import { saveBlob } from '@/utils/download';

export type FolderDownloadItem = {
  id: string;
  filename: string;
  getBlob: () => Promise<Blob>;
};

export type FolderDownloadProgress = {
  processed: number;
  total: number;
  currentFilename: string | null;
};

export type FolderDownloadResult = {
  mode: 'folder' | 'zip';
  saved: number;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
};

const uniqueFilename = (name: string, used: Set<string>): string => {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  let candidate = `${stem} (${n})${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${stem} (${n})${ext}`;
  }
  used.add(candidate);
  return candidate;
};

/** Folder picker only exists in a secure context (https / localhost). */
export const canPickDownloadFolder = (): boolean =>
  typeof window !== 'undefined' &&
  window.isSecureContext === true &&
  typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';

const blobToUint8Array = async (blob: Blob): Promise<Uint8Array> => {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  // jsdom / older Blob implementations
  return new Uint8Array(await new Response(blob).arrayBuffer());
};

const downloadAsZip = async (
  items: FolderDownloadItem[],
  onProgress?: (progress: FolderDownloadProgress) => void,
): Promise<FolderDownloadResult> => {
  const files: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();
  let saved = 0;

  for (const item of items) {
    onProgress?.({
      processed: saved,
      total: items.length,
      currentFilename: item.filename,
    });

    const blob = await item.getBlob();
    const name = uniqueFilename(item.filename, usedNames);
    files[name] = await blobToUint8Array(blob);
    saved += 1;

    onProgress?.({
      processed: saved,
      total: items.length,
      currentFilename: item.filename,
    });
  }

  const zipped = zipSync(files, { level: 0 });
  const stamp = new Date().toISOString().slice(0, 10);
  // Copy into a plain ArrayBuffer — some environments reject Uint8Array views.
  const bytes = new Uint8Array(zipped.byteLength);
  bytes.set(zipped);
  saveBlob(
    new Blob([bytes.buffer], { type: 'application/zip' }),
    `Form5_${stamp}.zip`,
  );

  return { mode: 'zip', saved };
};

/**
 * Ask the user for a folder, then write each file there with progress.
 * Falls back to a single ZIP when the Folder Picker API is unavailable
 * (HTTP LAN IP, Firefox, some Safari versions — not a secure context).
 */
export const downloadFilesToFolder = async (
  items: FolderDownloadItem[],
  onProgress?: (progress: FolderDownloadProgress) => void,
): Promise<FolderDownloadResult> => {
  if (!items.length) {
    return { mode: 'folder', saved: 0 };
  }

  if (canPickDownloadFolder()) {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker!;
    try {
      const directory = await picker.call(window, { mode: 'readwrite' });
      let saved = 0;
      const usedNames = new Set<string>();

      for (const item of items) {
        onProgress?.({
          processed: saved,
          total: items.length,
          currentFilename: item.filename,
        });

        const blob = await item.getBlob();
        const name = uniqueFilename(item.filename, usedNames);
        const fileHandle = await directory.getFileHandle(name, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        saved += 1;

        onProgress?.({
          processed: saved,
          total: items.length,
          currentFilename: item.filename,
        });
      }

      return { mode: 'folder', saved };
    } catch (err) {
      // User cancelled the picker — surface as AbortError to callers.
      if ((err as Error)?.name === 'AbortError') {
        throw err;
      }
      // NotAllowedError / insecure context quirks → ZIP fallback below.
    }
  }

  return downloadAsZip(items, onProgress);
};
