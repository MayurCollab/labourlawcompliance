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

const {
  saveFile,
  saveDocument,
  readFileBuffer,
  deleteFile,
  keyFromStoredPath,
  objectUrlForKey,
} = await import('../../src/storage/s3.storage.js');
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

  test('objectUrlForKey builds a virtual-hosted HTTPS URL', () => {
    expect(objectUrlForKey('generated/Form5.pdf')).toBe(
      'https://test-bucket.s3.ap-south-1.amazonaws.com/generated/Form5.pdf',
    );
  });

  test('keyFromStoredPath accepts S3 URLs and legacy /uploads paths', () => {
    expect(
      keyFromStoredPath(
        'https://test-bucket.s3.ap-south-1.amazonaws.com/generated/Ahmedabad_ACME_Jul-2026_abc.pdf',
      ),
    ).toBe('generated/Ahmedabad_ACME_Jul-2026_abc.pdf');
    expect(keyFromStoredPath('/uploads/avatars/old.png')).toBe('avatars/old.png');
    expect(keyFromStoredPath('https://evil.example/generated/x.pdf')).toBeNull();
  });

  test('saveFile uploads and returns an S3 HTTPS URL', async () => {
    send.mockResolvedValueOnce({});

    const stored = await saveFile({
      buffer: PNG_1X1,
      mimetype: 'image/png',
      folder: 'avatars',
    });

    expect(stored.mimetype).toBe('image/png');
    expect(stored.path).toMatch(
      /^https:\/\/test-bucket\.s3\.ap-south-1\.amazonaws\.com\/avatars\/avatar_.+\.png$/,
    );
    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0][0];
    expect(command.input.Bucket).toBe('test-bucket');
    expect(command.input.Key).toMatch(/^avatars\/avatar_.+\.png$/);
    expect(command.input.ContentType).toBe('image/png');
    expect(command.input.ServerSideEncryption).toBe('AES256');
    expect(Buffer.isBuffer(command.input.Body)).toBe(true);
  });

  test('saveDocument uses a readable key from originalName and returns S3 URL', async () => {
    send.mockResolvedValueOnce({});

    const stored = await saveDocument({
      buffer: MINIMAL_PDF,
      mimetype: 'application/pdf',
      folder: 'generated',
      originalName: 'Ahmedabad_ACME_Jul-2026.pdf',
    });

    expect(stored.mimetype).toBe('application/pdf');
    expect(stored.originalName).toBe('Ahmedabad_ACME_Jul-2026.pdf');
    expect(stored.path).toMatch(
      /^https:\/\/test-bucket\.s3\.ap-south-1\.amazonaws\.com\/generated\/Ahmedabad_ACME_Jul-2026_.+\.pdf$/,
    );
    expect(stored.size).toBeGreaterThan(0);

    const command = send.mock.calls[0][0];
    expect(command.input.Key).toMatch(
      /^generated\/Ahmedabad_ACME_Jul-2026_.+\.pdf$/,
    );
  });

  test('readFileBuffer returns object bytes from an S3 URL', async () => {
    send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => new Uint8Array(MINIMAL_PDF),
      },
    });

    const url =
      'https://test-bucket.s3.ap-south-1.amazonaws.com/generated/abc.pdf';
    const buffer = await readFileBuffer(url);
    expect(Buffer.compare(buffer, MINIMAL_PDF)).toBe(0);

    const command = send.mock.calls[0][0];
    expect(command.input.Key).toBe('generated/abc.pdf');
  });

  test('readFileBuffer still supports legacy /uploads paths', async () => {
    send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => new Uint8Array(MINIMAL_PDF),
      },
    });

    await readFileBuffer('/uploads/generated/abc.pdf');
    expect(send.mock.calls[0][0].input.Key).toBe('generated/abc.pdf');
  });

  test('readFileBuffer maps missing objects to FILE_NOT_FOUND', async () => {
    const missing = new Error('missing');
    missing.name = 'NoSuchKey';
    missing.$metadata = { httpStatusCode: 404 };
    send.mockRejectedValueOnce(missing);

    await expect(
      readFileBuffer(
        'https://test-bucket.s3.ap-south-1.amazonaws.com/generated/missing.pdf',
      ),
    ).rejects.toMatchObject({
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

  test('deleteFile sends DeleteObject for S3 URL paths', async () => {
    send.mockResolvedValueOnce({});
    await deleteFile(
      'https://test-bucket.s3.ap-south-1.amazonaws.com/avatars/old.png',
    );
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'test-bucket',
      Key: 'avatars/old.png',
    });
  });
});
