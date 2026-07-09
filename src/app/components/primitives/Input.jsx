import React, { forwardRef } from 'react';
import { cn } from '../../../utils/cn';
const Input = forwardRef(function Input({ className, ...rest }, ref){ return <input ref={ref} className={cn('input', className)} {...rest} /> });
export default Input;