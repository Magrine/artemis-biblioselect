import React from 'react';
import { cn } from '../../../utils/cn';
export function Navbar({ children, className }){
  return (
    <nav className={cn('nav', className)}>
      <div className="wrap">{children}</div>
    </nav>
  );
}