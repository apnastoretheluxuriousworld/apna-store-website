"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { deleteUserSessions, resetPassword } from "@/lib/auth/core";
import { db, schema as s } from "@/lib/db";
import type { ActionResult } from "@/lib/actions";
import { nameSchema, pinSchema } from "@/lib/validation/customer";

/*
 * Customer management. Every action only touches accounts with role
 * "customer", so an admin account can never be blocked/deleted from here.
 */

const idSchema = z.uuid();
const isCustomer = (id: string) => and(eq(s.users.id, id), eq(s.users.role, "customer"));

function changed() {
  revalidatePath("/admin", "layout");
}

export async function setCustomerBlocked(id: string, blocked: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof blocked !== "boolean") return { ok: false, error: "Invalid request." };
  const [row] = await db().update(s.users).set({ isBlocked: blocked }).where(isCustomer(id)).returning({ id: s.users.id });
  if (!row) return { ok: false, error: "Customer not found." };
  if (blocked) await deleteUserSessions(db(), id); // signed out everywhere, right now
  changed();
  return { ok: true };
}

export async function resetCustomerPin(id: string, pin: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid request." };
  const parsed = pinSchema.safeParse(pin);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const [row] = await db().select({ id: s.users.id }).from(s.users).where(isCustomer(id));
  if (!row) return { ok: false, error: "Customer not found." };
  await resetPassword(db(), id, parsed.data);
  changed();
  return { ok: true };
}

export async function updateCustomer(id: string, input: { name: string; adminNote: string }): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid request." };
  const name = nameSchema.safeParse(input?.name ?? "");
  if (!name.success) return { ok: false, error: name.error.issues[0].message, fieldErrors: { name: name.error.issues[0].message } };
  const note = String(input?.adminNote ?? "").trim().slice(0, 2000);
  const [row] = await db()
    .update(s.users)
    .set({ name: name.data, adminNote: note || null })
    .where(isCustomer(id))
    .returning({ id: s.users.id });
  if (!row) return { ok: false, error: "Customer not found." };
  changed();
  return { ok: true };
}

/** Deletes the account. Their orders stay (as guest orders) for the store's records. */
export async function deleteCustomer(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid request." };
  const [row] = await db().delete(s.users).where(isCustomer(id)).returning({ id: s.users.id });
  if (!row) return { ok: false, error: "Customer not found." };
  changed();
  return { ok: true };
}
