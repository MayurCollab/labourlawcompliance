export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const filenameFromContentDisposition = (
  header: string | undefined,
  fallback: string,
) => {
  if (!header) return fallback;
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const plain = header.match(/filename=([^;]+)/i);
  return plain?.[1]?.trim() || fallback;
};

/** Fix .xlsx name when the blob is actually a PDF (legacy download fallback). */
export const filenameForDownloadBlob = async (
  blob: Blob,
  filename: string,
) => {
  const head = await blob.slice(0, 5).text();
  if (head.startsWith('%PDF-') && !/\.pdf$/i.test(filename)) {
    const base = filename.replace(/\.[^.]+$/, '') || 'Form5';
    return `${base}.pdf`;
  }
  return filename;
};
