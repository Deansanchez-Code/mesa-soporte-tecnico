import React from "react";
import { NativeDialog } from "./NativeDialog";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "info",
  isLoading = false,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const bgColors = {
    danger: "bg-red-600 hover:bg-red-700",
    warning: "bg-[#FC7323] hover:bg-orange-600",
    info: "bg-[#39A900] hover:bg-[#2d8500]",
  };

  const badgeByVariant = {
    danger: "ALERTA · CRÍTICO",
    warning: "AVISO · OPERACIÓN",
    info: "GOV·SENA·2026",
  };

  return (
    <NativeDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      badgeText={badgeByVariant[variant]}
      maxWidthClass="max-w-md"
    >
      <div className="p-6">
        <div className="text-sm text-slate-700 leading-relaxed">{message}</div>
      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="min-h-[44px] px-4 py-2 text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg font-semibold transition disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`min-h-[44px] px-4 py-2 text-sm text-white rounded-lg font-bold transition active:translate-y-[1px] flex items-center gap-2 ${
            bgColors[variant]
          } disabled:opacity-50`}
        >
          {isLoading && (
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {confirmText}
        </button>
      </div>
    </NativeDialog>
  );
}
