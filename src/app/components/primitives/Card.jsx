import React from 'react';
import { cn } from '../../../utils/cn';
export function Card({ children, className, style }){ return <article style={style} className={cn('card', className)}>{children}</article>; }
export function CardBody({ children, className, style }){ return <div style={style} className={cn('card-body', className)}>{children}</div>; }