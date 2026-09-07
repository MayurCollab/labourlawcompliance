import { forwardRef, type ReactNode } from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { Loader2 } from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';

import {
  Button as UiButton,
  buttonVariants,
} from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UiVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;

export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive';

const variantMap: Record<AppButtonVariant, UiVariant> = {
  primary: 'default',
  secondary: 'secondary',
  outline: 'outline',
  ghost: 'ghost',
  destructive: 'destructive',
};

export type ButtonProps = Omit<ButtonPrimitive.Props, 'className' | 'color'> & {
  className?: string;
  variant?: AppButtonVariant;
  size?: VariantProps<typeof buttonVariants>['size'];
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
};

/**
 * App Button — wraps the shadcn/base-ui button with loading + icon slots.
 * Prefer this over importing `@/components/ui/button` in feature code.
 * Supports Base UI `render` (e.g. `render={<Link to="..." />}`).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'default',
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <UiButton
        ref={ref}
        type={type}
        variant={variantMap[variant]}
        size={size}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(className)}
        {...props}
      >
        {loading ? (
          <Loader2
            className="size-4 animate-spin"
            data-icon="inline-start"
            aria-hidden
          />
        ) : leftIcon ? (
          <span className="inline-flex shrink-0" data-icon="inline-start">
            {leftIcon}
          </span>
        ) : null}
        {children}
        {!loading && rightIcon ? (
          <span className="inline-flex shrink-0" data-icon="inline-end">
            {rightIcon}
          </span>
        ) : null}
      </UiButton>
    );
  },
);

Button.displayName = 'Button';
