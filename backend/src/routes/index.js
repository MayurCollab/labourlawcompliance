import { Router } from 'express';

import activityRoutes from '../modules/activity/activity.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import clientsRoutes from '../modules/clients/clients.routes.js';
import employeesRoutes from '../modules/employees/employees.routes.js';
import filingsRoutes from '../modules/filings/filings.routes.js';
import locationsRoutes from '../modules/locations/locations.routes.js';
import permissionsRoutes from '../modules/permissions/permissions.routes.js';
import ptSlabsRoutes from '../modules/ptSlabs/ptSlabs.routes.js';
import rolesRoutes from '../modules/roles/roles.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';
import templatesRoutes from '../modules/templates/templates.routes.js';
import uploadsRoutes from '../modules/uploads/uploads.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import healthRoutes from './health.routes.js';

/**
 * API v1 router — mounted at /api/v1 in app.js.
 * Every feature module registers its routes here:
 *   v1Router.use('/auth', authRoutes);
 *   v1Router.use('/users', userRoutes);
 */
const v1Router = Router();

v1Router.use('/health', healthRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/users', usersRoutes);
v1Router.use('/roles', rolesRoutes);
v1Router.use('/permissions', permissionsRoutes);
v1Router.use('/activity', activityRoutes);
v1Router.use('/clients', clientsRoutes);
v1Router.use('/locations', locationsRoutes);
v1Router.use('/pt-slabs', ptSlabsRoutes);
v1Router.use('/settings', settingsRoutes);
v1Router.use('/uploads', uploadsRoutes);
v1Router.use('/templates', templatesRoutes);
v1Router.use('/employees', employeesRoutes);
v1Router.use('/filings', filingsRoutes);

export default v1Router;
