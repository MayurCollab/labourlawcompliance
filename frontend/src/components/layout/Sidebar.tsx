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
        'flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        {brandIcon ?? <Shield className="size-5" aria-hidden />}
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
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
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
