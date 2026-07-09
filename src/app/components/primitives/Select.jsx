import React, { forwardRef } from 'react';
import { cn } from '../../../utils/cn';
const Select = forwardRef(function Select({ className, ...rest }, ref){ return <select ref={ref} className={cn('input', className)} {...rest} /> });
export default Select;