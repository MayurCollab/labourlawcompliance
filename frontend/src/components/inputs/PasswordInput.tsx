import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import { Input, type InputProps } from '@/components/inputs/Input';

export type PasswordInputProps = Omit<InputProps, 'type' | 'rightAddon'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (props, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        autoComplete={props.autoComplete ?? 'current-password'}
        rightAddon={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={visible ? 'Hide password' : 'Show password'}
            onClick={() => setVisible((value) => !value)}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        }
        {...props}
      />
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
