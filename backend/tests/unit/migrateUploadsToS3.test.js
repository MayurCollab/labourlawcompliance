import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const {
  MIGRATE_FOLDERS,
  SKIP_FOLDERS,
  contentTypeForName,
  shouldMigrateRelative,
  storedPathForRelative,
  listMigratableUploads,
} = await import('../../scripts/migrateUploadsToS3.mjs');

describe('migrateUploadsToS3 helpers', () => {
  test('migrates documents, generated, and avatars — never templates', () => {
    expect([...MIGRATE_FOLDERS].sort()).toEqual([
      'avatars',
      'documents',
      'generated',
    ]);
    expect([...SKIP_FOLDERS]).toEqual(['templates']);
    expect(shouldMigrateRelative('documents/a.xlsx')).toBe(true);
    expect(shouldMigrateRelative('generated/a.pdf')).toBe(true);
    expect(shouldMigrateRelative('avatars/a.png')).toBe(true);
    expect(shouldMigrateRelative('templates/form5.xlsx')).toBe(false);
    expect(shouldMigrateRelative('templates/nested/x.html')).toBe(false);
  });

  test('maps legacy /uploads paths and Excel/PDF content types', () => {
    expect(storedPathForRelative('documents/abc.xlsx')).toBe(
      '/uploads/documents/abc.xlsx',
    );
    expect(contentTypeForName('sheet.xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(contentTypeForName('form.pdf')).toBe('application/pdf');
    expect(contentTypeForName('photo.png')).toBe('image/png');
  });

  test('listMigratableUploads skips the templates folder', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'migrate-uploads-'));
    try {
      await fs.mkdir(path.join(root, 'documents'), { recursive: true });
      await fs.mkdir(path.join(root, 'templates'), { recursive: true });
      await fs.mkdir(path.join(root, 'generated'), { recursive: true });
      await fs.writeFile(path.join(root, 'documents', 'master.xlsx'), 'x');
      await fs.writeFile(path.join(root, 'templates', 'keep.xlsx'), 't');
      await fs.writeFile(path.join(root, 'generated', 'form5.pdf'), 'p');

      const listed = await listMigratableUploads(root);
      const relatives = listed.map((file) => file.relative).sort();
      expect(relatives).toEqual(['documents/master.xlsx', 'generated/form5.pdf']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
