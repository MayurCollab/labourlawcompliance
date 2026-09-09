import { Outlet } from 'react-router-dom';

import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { APP_SHORT_NAME } from '@/constants/app';
import { APP_NAV_ITEMS } from '@/constants/navigation';

/**
 * Authenticated app shell — Sidebar + Navbar + content area.
 * Nav items come from APP_NAV_ITEMS (permission-filtered in Sidebar).
 */
export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar items={APP_NAV_ITEMS} title={APP_SHORT_NAME} />
      <div className="flex min-w-0 flex-1 flex-col bg-transparent">
        <Navbar className="border-border/80 bg-card/80 backdrop-blur-md" />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
