import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import shared from "./shared.module.css";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  ariaLabel: string;
  /** Raise the modal above other open modals (nested dialogs). */
  foreground?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  children,
  className = "",
  ariaLabel,
  foreground = false,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`${shared.modalOverlay} ${foreground ? shared.modalOverlayForeground : ""}`}
        />
        <Dialog.Content
          className={`${shared.modalContent} ${className} ${
            foreground ? shared.modalContentForeground : ""
          }`}
          aria-label={ariaLabel}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
