import React from 'react';
import { cn } from '../../../utils/cn';
export default function Chip({ active, className, ...rest }){ return <button className={cn('chip', active && 'is-active', className)} {...rest}/>; }