import React from 'react';
import { cn } from '../../../utils/cn';
export default function Badge({ children, className }){ return <span className={cn('badge', className)}>{children}</span>; }