import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { APP_SHORT_NAME } from '@/constants/app';
import { APP_NAV_ITEMS } from '@/constants/navigation';

const SIDEBAR_COLLAPSED_KEY = 'llc.sidebar.collapsed';

const readCollapsedPreference = () => {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Authenticated app shell — Sidebar + Navbar + content area.
 * Nav items come from APP_NAV_ITEMS (permission-filtered in Sidebar).
 */
export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsedPreference);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_KEY,
        sidebarCollapsed ? '1' : '0',
      );
    } catch {
      // Ignore storage failures (private mode / quota).
    }
  }, [sidebarCollapsed]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        items={APP_NAV_ITEMS}
        title={APP_SHORT_NAME}
        collapsed={sidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-transparent">
        <Navbar
          className="border-border/80 bg-card/80 backdrop-blur-md"
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto p-3 sm:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
