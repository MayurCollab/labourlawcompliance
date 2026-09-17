import {
  useMemo,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from 'react';
import { NavLink } from 'react-router-dom';
import { Shield } from 'lucide-react';

import { usePermission } from '@/hooks/usePermission';
import { cn } from '@/lib/utils';

export type SidebarMenuItem = {
  to: string;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  end?: boolean;
  /** When set, item only renders if the current user has this permission. */
  requiredPermission?: string;
};

export type SidebarProps = {
  items: SidebarMenuItem[];
  title?: string;
  brandIcon?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Icon-only rail when true; full labels when false. */
  collapsed?: boolean;
};

/**
 * Generic app sidebar. Filters items through usePermission when
 * `requiredPermission` is set (Phase 7 dynamic menu).
 */
export function Sidebar({
  items,
  title = 'Blueprint',
  brandIcon,
  footer,
  className,
  collapsed = false,
}: SidebarProps) {
  const { hasPermission } = usePermission();

  const visibleItems = useMemo(
    () =>
      items.filter((item) =>
        item.requiredPermission
          ? hasPermission(item.requiredPermission)
          : true,
      ),
    [items, hasPermission],
  );

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[4px_0_24px_color-mix(in_oklch,black_18%,transparent)]',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center gap-2 border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          {brandIcon ?? <Shield className="size-4" aria-hidden />}
        </span>
        <span
          className={cn(
            'truncate font-semibold tracking-tight transition-opacity duration-200',
            collapsed ? 'sr-only' : 'opacity-100',
          )}
        >
          {title}
        </span>
      </div>

      <nav
        aria-label="Main"
        className={cn(
          'flex flex-1 flex-col gap-1 p-2',
          !collapsed && 'p-3',
        )}
      >
        {visibleItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            aria-label={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg text-sm transition-colors',
                collapsed
                  ? 'justify-center px-2 py-2.5'
                  : 'gap-2 px-3 py-2',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
          >
            {Icon ? (
              <Icon className="size-4 shrink-0" aria-hidden />
            ) : (
              <span
                className="flex size-4 shrink-0 items-center justify-center text-[0.65rem] font-semibold"
                aria-hidden
              >
                {label.charAt(0)}
              </span>
            )}
            <span
              className={cn(
                'truncate transition-opacity duration-200',
                collapsed ? 'sr-only' : 'opacity-100',
              )}
            >
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      {footer ? (
        <div
          className={cn(
            'border-t border-sidebar-border',
            collapsed ? 'p-2' : 'p-3',
          )}
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
