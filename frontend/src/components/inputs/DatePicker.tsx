import { forwardRef } from 'react';

import { Input, type InputProps } from '@/components/inputs/Input';

export type DatePickerProps = Omit<InputProps, 'type'>;

/** Native date input styled like the rest of the field set. */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (props, ref) => <Input ref={ref} type="date" {...props} />,
);

DatePicker.displayName = 'DatePicker';
