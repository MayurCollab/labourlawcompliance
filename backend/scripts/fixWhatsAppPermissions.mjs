/**
 * One-time script to fix WhatsApp template permissions casing.
 * Deletes old lowercase 'whatsapptemplates.*' permissions and lets
 * the seeder recreate them with the correct camelCase names.
 */
import { connectDB, disconnectDB } from '../src/config/db.js';
import Permission from '../src/modules/permissions/permission.model.js';
import Role from '../src/modules/roles/role.model.js';
import logger from '../src/utils/logger.js';

const run = async () => {
  await connectDB();

  // Find and hard-delete the old lowercase permissions
  const oldPermissions = await Permission.find({
    name: { $in: [
      'whatsapptemplates.view',
      'whatsapptemplates.create',
      'whatsapptemplates.edit',
      'whatsapptemplates.delete'
    ]}
  });

  if (oldPermissions.length === 0) {
    logger.info('[fix] No old lowercase permissions found');
    await disconnectDB();
    return;
  }

  const oldIds = oldPermissions.map(p => p._id);
  logger.info(`[fix] Found ${oldPermissions.length} old permissions, removing them`);

  // Remove these permissions from all roles
  await Role.updateMany(
    { permissions: { $in: oldIds } },
    { $pull: { permissions: { $in: oldIds } } }
  );

  // Hard delete the old permissions
  await Permission.deleteMany({ _id: { $in: oldIds } });

  logger.info('[fix] Old permissions deleted. Run the seeder to create new ones.');
  await disconnectDB();
};

run().catch(async (err) => {
  logger.error(`[fix] Failed: ${err.stack || err.message}`);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
