import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import shared from "./shared.module.css";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  ariaLabel: string;
}

export function Modal({ open, onOpenChange, children, className = "", ariaLabel }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={shared.modalOverlay} />
        <Dialog.Content className={`${shared.modalContent} ${className}`} aria-label={ariaLabel}>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
