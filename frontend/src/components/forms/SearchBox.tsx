import type { ClipboardEvent } from 'react';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import { Input } from '@/components/inputs/Input';
import { splitSearchTokens } from '@/lib/searchTokens';
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
  const tokenCount = splitSearchTokens(value).length;

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (!/[\n\r,;\t]/.test(text)) return;
    const tokens = splitSearchTokens(text);
    if (tokens.length <= 1) return;
    // Pasted a column of codes copied from Excel — keep every token, joined
    // so it stays visible and editable on one line.
    event.preventDefault();
    onChange(tokens.join(', '));
  };

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
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        className={tokenCount > 1 ? 'pr-20' : undefined}
        leftAddon={<Search className="size-4" />}
        rightAddon={
          value ? (
            <div className="flex items-center gap-1">
              {tokenCount > 1 ? (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium leading-none text-muted-foreground">
                  {tokenCount} codes
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => onChange('')}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : null
        }
      />
    </form>
  );
}
