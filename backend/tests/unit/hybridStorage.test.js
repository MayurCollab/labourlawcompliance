import { jest } from '@jest/globals';

const localSaveFile = jest.fn();
const localSaveDocument = jest.fn();
const localDeleteFile = jest.fn();
const localReadFileBuffer = jest.fn();

const s3SaveFile = jest.fn();
const s3SaveDocument = jest.fn();
const s3DeleteFile = jest.fn();
const s3ReadFileBuffer = jest.fn();

jest.unstable_mockModule('../../src/storage/local.storage.js', () => ({
  saveFile: localSaveFile,
  saveDocument: localSaveDocument,
  deleteFile: localDeleteFile,
  readFileBuffer: localReadFileBuffer,
}));

jest.unstable_mockModule('../../src/storage/s3.storage.js', () => ({
  saveFile: s3SaveFile,
  saveDocument: s3SaveDocument,
  deleteFile: s3DeleteFile,
  readFileBuffer: s3ReadFileBuffer,
  isOurS3ObjectUrl: (storedPath) =>
    typeof storedPath === 'string' &&
    /^https:\/\/.+\.amazonaws\.com\//i.test(storedPath) &&
    /\/(avatars|generated|documents)\//i.test(storedPath),
}));

const {
  S3_FOLDERS,
  LOCAL_FOLDERS,
  saveFile,
  saveDocument,
  deleteFile,
  readFileBuffer,
} = await import('../../src/storage/hybrid.storage.js');

describe('hybrid storage routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('S3_FOLDERS is avatars, documents, and generated (templates stay local)', () => {
    expect([...S3_FOLDERS].sort()).toEqual(['avatars', 'documents', 'generated']);
    expect([...LOCAL_FOLDERS]).toEqual(['templates']);
  });

  test('saveFile routes avatars to S3', async () => {
    s3SaveFile.mockResolvedValueOnce({ path: '/uploads/avatars/a.png' });
    await saveFile({ folder: 'avatars', buffer: Buffer.from('x'), mimetype: 'image/png' });
    expect(s3SaveFile).toHaveBeenCalledTimes(1);
    expect(localSaveFile).not.toHaveBeenCalled();
  });

  test('saveDocument routes generated and documents to S3; templates stay local', async () => {
    s3SaveDocument.mockResolvedValueOnce({ path: '/uploads/generated/a.pdf' });

    await saveDocument({ folder: 'generated', buffer: Buffer.from('x'), mimetype: 'application/pdf' });
    expect(s3SaveDocument).toHaveBeenCalledTimes(1);
    expect(localSaveDocument).not.toHaveBeenCalled();

    jest.clearAllMocks();
    s3SaveDocument.mockResolvedValueOnce({ path: '/uploads/documents/b.xlsx' });
    await saveDocument({ folder: 'documents', buffer: Buffer.from('x'), mimetype: 'application/vnd.ms-excel' });
    expect(s3SaveDocument).toHaveBeenCalledTimes(1);
    expect(localSaveDocument).not.toHaveBeenCalled();

    jest.clearAllMocks();
    localSaveDocument.mockResolvedValueOnce({ path: '/uploads/templates/c.html' });
    await saveDocument({ folder: 'templates', buffer: Buffer.from('x'), mimetype: 'text/html' });
    expect(localSaveDocument).toHaveBeenCalledTimes(1);
    expect(s3SaveDocument).not.toHaveBeenCalled();
  });

  test('read/delete route by public path folder or S3 URL', async () => {
    s3ReadFileBuffer.mockResolvedValueOnce(Buffer.from('s3'));
    localReadFileBuffer.mockResolvedValueOnce(Buffer.from('local'));

    await readFileBuffer('/uploads/avatars/a.png');
    expect(s3ReadFileBuffer).toHaveBeenCalledWith('/uploads/avatars/a.png');
    expect(localReadFileBuffer).not.toHaveBeenCalled();

    await readFileBuffer('/uploads/documents/b.xlsx');
    expect(s3ReadFileBuffer).toHaveBeenCalledWith('/uploads/documents/b.xlsx');
    expect(localReadFileBuffer).not.toHaveBeenCalled();

    await deleteFile('/uploads/generated/c.pdf');
    expect(s3DeleteFile).toHaveBeenCalledWith('/uploads/generated/c.pdf');

    await deleteFile('/uploads/templates/d.html');
    expect(localDeleteFile).toHaveBeenCalledWith('/uploads/templates/d.html');

    jest.clearAllMocks();
    const s3Url =
      'https://test-bucket.s3.ap-south-1.amazonaws.com/generated/Form5_abc.pdf';
    s3ReadFileBuffer.mockResolvedValueOnce(Buffer.from('from-url'));
    await readFileBuffer(s3Url);
    expect(s3ReadFileBuffer).toHaveBeenCalledWith(s3Url);
    expect(localReadFileBuffer).not.toHaveBeenCalled();
  });
});
