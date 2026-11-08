"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { ConfirmDialog, Field, Switch, inputClass } from "@/components/admin/form";
import { Card } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/validation/customer";
import { deleteCustomer, resetCustomerPin, setCustomerBlocked, updateCustomer } from "../actions";
import { cn } from "@/lib/utils";

type Customer = { id: string; name: string; adminNote: string; isBlocked: boolean; phone: string | null };

/** Right-hand panel: edit name/note, block, reset PIN, delete. Saves are optimistic. */
export function CustomerManage({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [name, setName] = useState(customer.name);
  const [note, setNote] = useState(customer.adminNote);
  const [saved, setSaved] = useState({ name: customer.name, note: customer.adminNote });
  const [blocked, setBlocked] = useState(customer.isBlocked);
  const [pin, setPin] = useState("");
  const [, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetting, startReset] = useTransition();

  const dirty = name.trim() !== saved.name || note.trim() !== saved.note;

  function saveDetails() {
    const prev = saved;
    const next = { name: name.trim(), note: note.trim() };
    setSaved(next); // instant
    start(async () => {
      const res = await updateCustomer(customer.id, { name: next.name, adminNote: next.note });
      if (res.ok) {
        toast.success("Customer updated");
        router.refresh();
      } else {
        setSaved(prev);
        toast.error(res.error);
      }
    });
  }

  function toggleBlocked(v: boolean) {
    setBlocked(v);
    start(async () => {
      const res = await setCustomerBlocked(customer.id, v);
      if (res.ok) toast.success(v ? "Customer blocked and signed out" : "Customer unblocked");
      else {
        setBlocked(!v);
        toast.error(res.error);
      }
    });
  }

  function resetPin() {
    if (!/^\d{4}$/.test(pin)) return void toast.error("Enter a 4-digit PIN");
    startReset(async () => {
      const res = await resetCustomerPin(customer.id, pin);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`PIN reset. Tell ${customer.name.split(" ")[0]} their new PIN: ${pin}`, { duration: 10000 });
      setPin("");
    });
  }

  function doDelete() {
    startDelete(async () => {
      const res = await deleteCustomer(customer.id);
      if (!res.ok) {
        setConfirmDelete(false);
        return void toast.error(res.error);
      }
      toast.success("Customer deleted");
      router.replace("/admin/customers");
    });
  }

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Manage</h2>
        <Field label="Name" htmlFor="c-name">
          <input id="c-name" className={inputClass} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Private note" htmlFor="c-note" hint="Only the store sees this, e.g. preferences or sizes.">
          <textarea
            id="c-note"
            rows={3}
            maxLength={2000}
            className={cn(inputClass, "h-auto py-2.5")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Button type="button" size="sm" disabled={!dirty || name.trim().length < 2} onClick={saveDetails}>
          Save
        </Button>

        <div className="flex items-center justify-between gap-3 border-t border-ink-600/70 pt-4">
          <span>
            <span className="block text-sm text-ivory">Blocked</span>
            <span className="block text-xs text-mute">Can&apos;t sign in; signed out everywhere.</span>
          </span>
          <Switch checked={blocked} onChange={toggleBlocked} label="Block this customer" />
        </div>

        <div className="border-t border-ink-600/70 pt-4">
          <p className="flex items-center gap-2 text-sm text-ivory">
            <KeyRound className="size-4 text-gold-400" strokeWidth={1.5} /> Reset PIN
          </p>
          <p className="mt-1 text-xs text-mute">
            For a customer who forgot their PIN. Confirm it&apos;s really them (call +91 {formatPhone(customer.phone)}), then share the new PIN.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              aria-label="New 4-digit PIN"
              inputMode="numeric"
              maxLength={4}
              placeholder="New PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className={cn(inputClass, "w-32 text-center tracking-[0.4em]")}
            />
            <Button type="button" size="sm" variant="outline" className="h-11" disabled={pin.length !== 4 || resetting} onClick={resetPin}>
              {resetting ? <Loader2 className="size-3.5 animate-spin" /> : "Reset"}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-2 border-t border-ink-600/70 pt-4 text-xs text-red-400/80 hover:text-red-300"
        >
          <Trash2 className="size-3.5" /> Delete customer
        </button>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this customer?"
        body={
          <>
            <strong className="text-ivory">{customer.name}</strong>&apos;s account is removed and they can no longer sign in. Their orders stay in Orders as
            guest orders.
          </>
        }
        pending={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
