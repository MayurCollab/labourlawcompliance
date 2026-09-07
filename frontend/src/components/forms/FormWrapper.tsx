import type { ReactNode } from 'react';
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';

import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { cn } from '@/lib/utils';

export type FormWrapperProps<TFieldValues extends FieldValues> = {
  schema: ZodType<TFieldValues>;
  defaultValues?: DefaultValues<TFieldValues>;
  onSubmit: (
    data: TFieldValues,
    form: UseFormReturn<TFieldValues>,
  ) => void | Promise<void>;
  children: ReactNode | ((form: UseFormReturn<TFieldValues>) => ReactNode);
  className?: string;
  id?: string;
  /**
   * Warn before navigating away with dirty fields. On by default —
   * set false for login/search forms where "unsaved" is meaningless.
   */
  guardUnsavedChanges?: boolean;
  unsavedMessage?: string;
};

/**
 * Thin react-hook-form + zodResolver wrapper. Feature forms pass a Zod
 * schema and either render-prop children (with `form`) or nested fields
 * that use `useFormContext()`.
 */
export function FormWrapper<TFieldValues extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  id,
  guardUnsavedChanges = true,
  unsavedMessage,
}: FormWrapperProps<TFieldValues>) {
  const form = useForm<TFieldValues>({
    // zodResolver typings differ slightly across zod major versions
    resolver: zodResolver(schema as never),
    defaultValues,
  });

  useUnsavedChangesGuard({
    when: guardUnsavedChanges && form.formState.isDirty,
    message: unsavedMessage,
  });

  return (
    <FormProvider {...form}>
      <form
        id={id}
        className={cn('space-y-4', className)}
        onSubmit={form.handleSubmit(async (data) => {
          await onSubmit(data, form);
          // Successful submit is no longer "unsaved"
          form.reset(data);
        })}
        noValidate
      >
        {typeof children === 'function' ? children(form) : children}
      </form>
    </FormProvider>
  );
}
