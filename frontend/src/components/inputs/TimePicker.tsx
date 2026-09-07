import { forwardRef } from 'react';

import { Input, type InputProps } from '@/components/inputs/Input';

export type TimePickerProps = Omit<InputProps, 'type'>;

/** Native time input styled like the rest of the field set. */
export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  (props, ref) => <Input ref={ref} type="time" {...props} />,
);

TimePicker.displayName = 'TimePicker';
