import type { ReactNode } from 'react';

import {
  Breadcrumb,
  type BreadcrumbItem,
} from '@/components/common/Breadcrumb';
import { cn } from '@/lib/utils';

export type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-3 space-y-1.5', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb items={breadcrumbs} />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            <span className="bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              {title}
            </span>
          </h1>
          {description ? (
            <p className="max-w-3xl text-xs text-muted-foreground sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
