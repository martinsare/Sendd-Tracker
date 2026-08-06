"use client";
import { createContext, useCallback, useContext, useState } from "react";

type ToastMessage = { id: number; message: string; kind: "info" | "error" | "success" };
type ToastContextValue = { addToast: (message: string, kind?: ToastMessage["kind"]) => void };

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  let _id = 0;

  const addToast = useCallback((message: string, kind: ToastMessage["kind"] = "info") => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite" aria-label="Notifications">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast--${toast.kind}`} role="alert">
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
