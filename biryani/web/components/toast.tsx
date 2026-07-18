"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  title: string;
  message?: string;
  type: "success" | "error" | "warning" | "info";
}

interface ToastContextType {
  toast: (title: string, message?: string, type?: Toast["type"]) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
});

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = useCallback((title: string, message?: string, type: Toast["type"] = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{
      toast: addToast,
      success: (title, msg) => addToast(title, msg, "success"),
      error: (title, msg) => addToast(title, msg, "error"),
      warning: (title, msg) => addToast(title, msg, "warning"),
    }}>
      {children}
      {mounted && createPortal(
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-5",
                "max-w-sm cursor-pointer transition-all",
                t.type === "success" && "border-green-500/30 bg-green-500/10",
                t.type === "error" && "border-red-500/30 bg-red-500/10",
                t.type === "warning" && "border-yellow-500/30 bg-yellow-500/10",
                t.type === "info" && "border-blue-500/30 bg-blue-500/10",
              )}
              onClick={() => removeToast(t.id)}
            >
              <span className="mt-0.5 text-lg">
                {t.type === "success" && "✓"}
                {t.type === "error" && "✗"}
                {t.type === "warning" && "⚠"}
                {t.type === "info" && "ℹ"}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-muted-foreground">{t.message}</p>}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
