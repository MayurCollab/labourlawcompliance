import {
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  LayoutTemplate,
  Scale,
  Shield,
  ShieldCheck,
  Upload,
  Users,
  UsersRound,
} from 'lucide-react';

import type { SidebarMenuItem } from '@/components/layout/Sidebar';
import { PERMISSIONS } from '@/constants/permissions';
import { PATHS } from '@/routes/paths';

/**
 * App navigation config. Items with `requiredPermission` are filtered in
 * the Sidebar via usePermission — this is the reference pattern for every
 * future module nav entry.
 */
export const APP_NAV_ITEMS: SidebarMenuItem[] = [
  {
    to: PATHS.home,
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: PATHS.clients,
    label: 'Clients',
    icon: Building2,
    requiredPermission: PERMISSIONS.CLIENTS_VIEW,
  },
  {
    to: PATHS.ptSlabs,
    label: 'PT slabs',
    icon: Scale,
    requiredPermission: PERMISSIONS.CLIENTS_VIEW,
  },
  {
    to: PATHS.uploads,
    label: 'Uploads',
    icon: Upload,
    requiredPermission: PERMISSIONS.UPLOADS_VIEW,
  },
  {
    to: PATHS.employees,
    label: 'Employees',
    icon: UsersRound,
    requiredPermission: PERMISSIONS.EMPLOYEES_VIEW,
  },
  {
    to: PATHS.form5,
    label: 'Form 5',
    icon: FileSpreadsheet,
    requiredPermission: PERMISSIONS.FILINGS_VIEW,
  },
  {
    to: PATHS.templates,
    label: 'Templates (legacy)',
    icon: LayoutTemplate,
    requiredPermission: PERMISSIONS.TEMPLATES_CREATE,
  },
  {
    to: PATHS.users,
    label: 'Users',
    icon: Users,
    requiredPermission: PERMISSIONS.USERS_VIEW,
  },
  {
    to: PATHS.roles,
    label: 'Roles',
    icon: Shield,
    requiredPermission: PERMISSIONS.ROLES_VIEW,
  },
  {
    to: PATHS.permissions,
    label: 'Permissions',
    icon: ShieldCheck,
    requiredPermission: PERMISSIONS.ROLES_VIEW,
  },
];
