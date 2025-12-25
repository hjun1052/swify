"use client";

import React, { useEffect } from "react";
import styles from "./Toast.module.css";
import { Sparkles, X } from "lucide-react";

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  onClick?: () => void;
}

export default function Toast({ message, isVisible, onClose, onClick }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Auto-hide after 5s
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className={styles.toastContainer} onClick={onClick}>
      <div className={styles.iconWrapper}>
        <Sparkles size={20} color="#FF6B35" />
      </div>
      <p className={styles.message}>{message}</p>
      <button
        className={styles.closeBtn}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}
