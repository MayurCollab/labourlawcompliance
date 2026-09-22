import { Check, Laptop, Moon, Sun } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/common/Card';
import { PageHeader } from '@/components/layout/PageHeader';
import { useTheme } from '@/context/ThemeProvider';
import { PATHS } from '@/routes/paths';
import { cn } from '@/lib/utils';
import type { ThemeMode } from '@/utils/storage';

const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright surface for well-lit rooms.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Dimmed surface, easier on the eyes at night.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Match your device’s appearance setting.',
    icon: Laptop,
  },
];

/**
 * Account settings hub. Currently hosts the Theme section; add further
 * settings sections here as they come up.
 */
export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Settings"
        description="Manage your account preferences."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Settings' },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Choose how the app looks. Your preference is saved to this
            browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => {
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-muted',
                    selected
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border',
                  )}
                >
                  {selected ? (
                    <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                  ) : null}
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
