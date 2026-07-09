import React, { useEffect } from 'react';
import { cn } from '../../../utils/cn';
export default function Modal({ isOpen, onClose, labelledBy, className, children }){
  useEffect(()=>{
    const onKey = (e)=>{ if(e.key==='Escape') onClose?.(); };
    if(isOpen) window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  },[isOpen,onClose]);
  if(!isOpen) return null;
  return (
    <div className={cn('modal')} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="modal-backdrop" onClick={onClose}/>
      <div className="modal-panel">
        <div className={cn('modal-card', className)}>{children}</div>
      </div>
    </div>
  );
}