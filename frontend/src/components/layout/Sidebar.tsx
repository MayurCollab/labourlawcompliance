import { useMemo, type ComponentType, type ReactNode, type SVGProps } from 'react';
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
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[4px_0_24px_color-mix(in_oklch,black_18%,transparent)]',
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          {brandIcon ?? <Shield className="size-4" aria-hidden />}
        </span>
        <span className="font-semibold tracking-tight">{title}</span>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
        {visibleItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
          >
            {Icon ? <Icon className="size-4" aria-hidden /> : null}
            {label}
          </NavLink>
        ))}
      </nav>

      {footer ? (
        <div className="border-t border-sidebar-border p-3">{footer}</div>
      ) : null}
    </aside>
  );
}
