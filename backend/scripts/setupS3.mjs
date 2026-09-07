/**
 * Create (if missing) and harden the S3 bucket from backend/.env.
 *
 * Usage: npm run setup:s3
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketEncryptionCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import config from '../src/config/index.js';

const { region, bucket, accessKeyId, secretAccessKey } = config.storage.s3;

if (!bucket || !accessKeyId || !secretAccessKey || !region) {
  console.error(
    'Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_BUCKET_NAME in backend/.env',
  );
  process.exit(1);
}

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

const exists = async () => {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    const name = error?.name || error?.Code || '';
    if (status === 404 || name === 'NotFound' || name === 'NoSuchBucket') {
      return false;
    }
    throw error;
  }
};

const create = async () => {
  const input = { Bucket: bucket };
  if (region !== 'us-east-1') {
    input.CreateBucketConfiguration = { LocationConstraint: region };
  }
  await client.send(new CreateBucketCommand(input));
};

const harden = async () => {
  await client.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true,
      },
    }),
  );
  await client.send(
    new PutBucketEncryptionCommand({
      Bucket: bucket,
      ServerSideEncryptionConfiguration: {
        Rules: [
          {
            ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' },
            BucketKeyEnabled: true,
          },
        ],
      },
    }),
  );
};

const probe = async () => {
  const key = `_health/${Date.now()}.txt`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: 'ok',
      ContentType: 'text/plain',
      ServerSideEncryption: 'AES256',
    }),
  );
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};

try {
  const already = await exists();
  if (already) {
    console.log(`Bucket "${bucket}" already exists in ${region}.`);
  } else {
    console.log(`Creating bucket "${bucket}" in ${region}...`);
    await create();
    console.log('Bucket created.');
  }

  await harden();
  console.log('Public access blocked; default AES-256 encryption enabled.');

  await probe();
  console.log('Put/delete probe succeeded. S3 is ready.');
  console.log('Set STORAGE_DRIVER=s3 in backend/.env and restart the API.');
} catch (error) {
  const status = error?.$metadata?.httpStatusCode;
  console.error(`S3 setup failed (${error?.name || 'Error'} ${status || ''}): ${error.message}`);
  if (status === 403) {
    console.error(
      'The IAM user needs s3:CreateBucket (if new), s3:ListBucket, s3:PutObject, s3:GetObject, s3:DeleteObject, s3:PutBucketPublicAccessBlock, and s3:PutEncryptionConfiguration.',
    );
  }
  process.exit(1);
}
