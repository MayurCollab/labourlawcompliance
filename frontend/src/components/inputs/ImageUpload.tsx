import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ImagePlus, X } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import {
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from '@/components/inputs/fieldStyles';
import { cn } from '@/lib/utils';

export type ImageUploadProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value' | 'accept'
> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value?: File | string | null;
  onChange?: (file: File | null) => void;
  containerClassName?: string;
};

export const ImageUpload = forwardRef<HTMLInputElement, ImageUploadProps>(
  (
    {
      className,
      label,
      hint,
      error,
      value,
      onChange,
      id,
      containerClassName,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const objectUrlRef = useRef<string | null>(null);

    const [previewUrl, setPreviewUrl] = useState<string | null>(
      typeof value === 'string' ? value : null,
    );

    useEffect(() => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      if (typeof value === 'string') {
        setPreviewUrl(value);
        return undefined;
      }

      if (value instanceof File) {
        const url = URL.createObjectURL(value);
        objectUrlRef.current = url;
        setPreviewUrl(url);
        return () => {
          URL.revokeObjectURL(url);
          if (objectUrlRef.current === url) objectUrlRef.current = null;
        };
      }

      setPreviewUrl(null);
      return undefined;
    }, [value]);

    const assignFile = (file: File | null) => {
      onChange?.(file);
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      assignFile(event.target.files?.[0] ?? null);
    };

    const onDrop = (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      if (disabled) return;
      const file = event.dataTransfer.files?.[0] ?? null;
      if (file && file.type.startsWith('image/')) {
        assignFile(file);
      }
    };

    const openPicker = () => {
      if (!disabled) inputRef.current?.click();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    };

    const describedBy = [
      error ? errorId : null,
      !error && hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}

        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={typeof label === 'string' ? label : 'Upload image'}
          aria-disabled={disabled || undefined}
          aria-describedby={describedBy || undefined}
          onClick={openPicker}
          onKeyDown={onKeyDown}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'relative flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-muted/30 p-4 text-center',
            'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            dragging && 'border-primary bg-primary/5',
            disabled && 'opacity-50',
            className,
          )}
        >
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="Upload preview"
                width={160}
                height={160}
                loading="lazy"
                decoding="async"
                className="max-h-40 rounded-md object-contain"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<X className="size-3.5" aria-hidden />}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  if (inputRef.current) inputRef.current.value = '';
                  assignFile(null);
                }}
              >
                Remove
              </Button>
            </>
          ) : (
            <>
              <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium">Drag & drop an image</p>
                <p className="text-xs text-muted-foreground">
                  or press Enter to browse (JPEG, PNG, WEBP, GIF)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  openPicker();
                }}
              >
                Browse
              </Button>
            </>
          )}

          <input
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={disabled}
            onChange={handleChange}
            aria-invalid={Boolean(error) || undefined}
            {...props}
          />
        </div>

        {error ? (
          <p id={errorId} role="alert" className={fieldErrorClassName}>
            {error}
          </p>
        ) : null}
        {!error && hint ? (
          <p id={hintId} className={fieldHintClassName}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

ImageUpload.displayName = 'ImageUpload';
