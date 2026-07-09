import React, { forwardRef } from 'react';
import { cn } from '@/utils/cn';
const Textarea = forwardRef(function Textarea({ className, ...rest }, ref){ return <textarea ref={ref} className={cn('input', className)} {...rest} /> });
export default Textarea;