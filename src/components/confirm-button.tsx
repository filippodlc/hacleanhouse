"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, type ComponentProps, type ReactNode } from "react";

/**
 * Bottone che apre una modale di conferma prima di eseguire l'azione.
 * Usato per tutte le operazioni di cancellazione irreversibili: il trigger
 * eredita le props del Button (size/variant/ecc.), così resta identico al
 * bottone che sostituisce; `onConfirm` parte solo dopo conferma esplicita.
 */
export function ConfirmButton({
  onConfirm,
  title = "Confermi l'eliminazione?",
  description = "L'operazione non è reversibile.",
  confirmLabel = "Elimina",
  cancelLabel = "Annulla",
  destructive = true,
  children,
  ...buttonProps
}: {
  onConfirm: () => void;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  children: ReactNode;
} & Omit<ComponentProps<typeof Button>, "onClick">) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {description && <DialogDescription>{description}</DialogDescription>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{cancelLabel}</Button>
            </DialogClose>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
