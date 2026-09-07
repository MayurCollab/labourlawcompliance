import {
  forwardRef,
  useId,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { FileIcon, Upload, X } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import {
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from '@/components/inputs/fieldStyles';
import { cn } from '@/lib/utils';

export type FileUploadProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value'
> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value?: File | FileList | null;
  onChange?: (files: FileList | null) => void;
  containerClassName?: string;
};

export const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(
  (
    {
      className,
      label,
      hint,
      error,
      value,
      onChange,
      id,
      multiple,
      containerClassName,
      disabled,
      accept,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const inputRef = useRef<HTMLInputElement | null>(null);

    const files: File[] = value
      ? value instanceof File
        ? [value]
        : Array.from(value)
      : [];

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.files);
    };

    const clear = () => {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      onChange?.(null);
    };

    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}

        <div
          className={cn(
            'flex flex-col gap-3 rounded-lg border border-dashed border-input bg-muted/30 p-4',
            disabled && 'opacity-50',
            className,
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-background">
              <Upload className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Choose a file</p>
              <p className="text-xs text-muted-foreground">
                {accept ? `Accepted: ${accept}` : 'Any file type'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Browse
            </Button>
          </div>

          <input
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            id={inputId}
            type="file"
            className="sr-only"
            multiple={multiple}
            accept={accept}
            disabled={disabled}
            onChange={handleChange}
            {...props}
          />

          {files.length > 0 ? (
            <ul className="space-y-2">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${file.name}`}
                    onClick={clear}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? <p className={fieldErrorClassName}>{error}</p> : null}
        {!error && hint ? <p className={fieldHintClassName}>{hint}</p> : null}
      </div>
    );
  },
);

FileUpload.displayName = 'FileUpload';
