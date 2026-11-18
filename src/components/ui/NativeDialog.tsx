"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface NativeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badgeText?: string;
  headerIcon?: React.ReactNode;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function NativeDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  badgeText = "GOV·SENA·2026",
  headerIcon,
  maxWidthClass = "max-w-lg",
  children,
}: NativeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (typeof dialog.showModal === "function") {
        if (!dialog.open) {
          try {
            dialog.showModal();
          } catch {
            dialog.setAttribute("open", "");
          }
        }
      } else {
        dialog.setAttribute("open", "");
      }
    } else {
      if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className={`swiss-dialog w-[calc(100%-2rem)] ${maxWidthClass} overflow-hidden`}
      aria-labelledby="swiss-dialog-title"
    >
      <div className="bg-[#043263] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-[#39A900]">
        <div className="flex items-center gap-3 min-w-0">
          {headerIcon && (
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              {headerIcon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="tabular-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#39A900] text-white">
                {badgeText}
              </span>
              {subtitle && (
                <span className="text-xs text-emerald-300 font-semibold truncate">
                  {subtitle}
                </span>
              )}
            </div>
            <h3
              id="swiss-dialog-title"
              className="text-base font-bold tracking-tight text-white truncate mt-0.5"
            >
              {title}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana modal"
          className="w-11 h-11 rounded-lg bg-white/10 hover:bg-white/20 active:translate-y-[1px] flex items-center justify-center text-white transition shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="bg-white text-[var(--text-primary)]">{children}</div>
    </dialog>
  );
}
