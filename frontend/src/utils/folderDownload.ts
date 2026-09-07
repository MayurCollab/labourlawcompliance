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

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
};

export const canPickDownloadFolder = (): boolean =>
  typeof window !== 'undefined' &&
  typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';

/**
 * Ask the user for a folder, then write each file there with progress.
 * Falls back to one-by-one browser downloads when the Folder Picker API
 * is unavailable (Firefox / some Safari versions).
 */
export const downloadFilesToFolder = async (
  items: FolderDownloadItem[],
  onProgress?: (progress: FolderDownloadProgress) => void,
): Promise<{ mode: 'folder' | 'sequential'; saved: number }> => {
  if (!items.length) {
    return { mode: 'folder', saved: 0 };
  }

  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (typeof picker === 'function') {
    const directory = await picker.call(window, { mode: 'readwrite' });
    let saved = 0;

    for (const item of items) {
      onProgress?.({
        processed: saved,
        total: items.length,
        currentFilename: item.filename,
      });

      const blob = await item.getBlob();
      const fileHandle = await directory.getFileHandle(item.filename, {
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
  }

  let saved = 0;
  for (const item of items) {
    onProgress?.({
      processed: saved,
      total: items.length,
      currentFilename: item.filename,
    });
    const blob = await item.getBlob();
    saveBlob(blob, item.filename);
    saved += 1;
    onProgress?.({
      processed: saved,
      total: items.length,
      currentFilename: item.filename,
    });
    // Give the browser time to start each download when falling back.
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return { mode: 'sequential', saved };
};
