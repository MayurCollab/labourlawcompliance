import { Search, X } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import { Input } from '@/components/inputs/Input';
import { cn } from '@/lib/utils';

export type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onSubmit?: (value: string) => void;
};

export function SearchBox({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  disabled,
  onSubmit,
}: SearchBoxProps) {
  return (
    <form
      className={cn('w-full max-w-sm', className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
    >
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        leftAddon={<Search className="size-4" />}
        rightAddon={
          value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              onClick={() => onChange('')}
            >
              <X className="size-3.5" />
            </Button>
          ) : null
        }
      />
    </form>
  );
}
