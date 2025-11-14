import { forwardRef } from 'react';
import { cn } from '../../../utils/cn';

const Button = forwardRef(function Button({ className, variant='primary', ...rest }, ref){
  return (
    <button
      ref={ref}
      className={cn(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'secondary' && 'btn-secondary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'copper' && 'btn-copper',
        variant === 'red' && 'btn-red',
        className
      )}
      {...rest}
    />
  );
});
export default Button;