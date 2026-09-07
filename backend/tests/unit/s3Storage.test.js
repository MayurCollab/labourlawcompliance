import { jest } from '@jest/globals';

const send = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = send;
  },
  PutObjectCommand: class {
    constructor(input) {
      this.input = input;
    }
  },
  GetObjectCommand: class {
    constructor(input) {
      this.input = input;
    }
  },
  DeleteObjectCommand: class {
    constructor(input) {
      this.input = input;
    }
  },
}));

jest.unstable_mockModule('../../src/config/index.js', () => ({
  default: {
    env: 'test',
    isProduction: false,
    isDevelopment: false,
    isTest: true,
    storage: {
      driver: 's3',
      s3: {
        region: 'ap-south-1',
        bucket: 'test-bucket',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    },
  },
}));

const { saveFile, saveDocument, readFileBuffer, deleteFile } = await import(
  '../../src/storage/s3.storage.js'
);
const AppError = (await import('../../src/utils/AppError.js')).default;

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

describe('s3 storage driver', () => {
  beforeEach(() => {
    send.mockReset();
  });

  test('saveFile uploads a processed image and returns a public /uploads path', async () => {
    send.mockResolvedValueOnce({});

    const stored = await saveFile({
      buffer: PNG_1X1,
      mimetype: 'image/png',
      folder: 'avatars',
    });

    expect(stored.mimetype).toBe('image/png');
    expect(stored.path).toMatch(/^\/uploads\/avatars\/[0-9a-f-]{36}\.png$/);
    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0][0];
    expect(command.input.Bucket).toBe('test-bucket');
    expect(command.input.Key).toMatch(/^avatars\/[0-9a-f-]{36}\.png$/);
    expect(command.input.ContentType).toBe('image/png');
    expect(command.input.ServerSideEncryption).toBe('AES256');
    expect(Buffer.isBuffer(command.input.Body)).toBe(true);
  });

  test('saveDocument uploads a PDF under documents/', async () => {
    send.mockResolvedValueOnce({});

    const stored = await saveDocument({
      buffer: MINIMAL_PDF,
      mimetype: 'application/pdf',
      folder: 'generated',
      originalName: 'Form5.pdf',
    });

    expect(stored.mimetype).toBe('application/pdf');
    expect(stored.originalName).toBe('Form5.pdf');
    expect(stored.path).toMatch(/^\/uploads\/generated\/[0-9a-f-]{36}\.pdf$/);
    expect(stored.size).toBeGreaterThan(0);

    const command = send.mock.calls[0][0];
    expect(command.input.Key).toMatch(/^generated\/[0-9a-f-]{36}\.pdf$/);
  });

  test('readFileBuffer returns object bytes', async () => {
    send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => new Uint8Array(MINIMAL_PDF),
      },
    });

    const buffer = await readFileBuffer('/uploads/generated/abc.pdf');
    expect(Buffer.compare(buffer, MINIMAL_PDF)).toBe(0);

    const command = send.mock.calls[0][0];
    expect(command.input.Key).toBe('generated/abc.pdf');
  });

  test('readFileBuffer maps missing objects to FILE_NOT_FOUND', async () => {
    const missing = new Error('missing');
    missing.name = 'NoSuchKey';
    missing.$metadata = { httpStatusCode: 404 };
    send.mockRejectedValueOnce(missing);

    await expect(readFileBuffer('/uploads/generated/missing.pdf')).rejects.toMatchObject({
      statusCode: 404,
      code: 'FILE_NOT_FOUND',
    });
  });

  test('readFileBuffer rejects path traversal', async () => {
    await expect(readFileBuffer('/uploads/../secret.png')).rejects.toBeInstanceOf(
      AppError,
    );
    expect(send).not.toHaveBeenCalled();
  });

  test('deleteFile ignores unknown public paths', async () => {
    await deleteFile('https://example.com/x.png');
    await deleteFile('/uploads/../escape.png');
    expect(send).not.toHaveBeenCalled();
  });

  test('deleteFile sends DeleteObject for stored paths', async () => {
    send.mockResolvedValueOnce({});
    await deleteFile('/uploads/avatars/old.png');
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'test-bucket',
      Key: 'avatars/old.png',
    });
  });
});
