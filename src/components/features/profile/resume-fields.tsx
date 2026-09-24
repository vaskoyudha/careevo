"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import type { ResumeFormState } from "@/actions/resume";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * One add/edit dialog for a resume list section.
 *
 * Rather than six near-identical dialogs, sections declare their fields and
 * this renders the form, wires `useActionState`, and shows the result message.
 * A field is a text input, a textarea, or a URL input — enough for every
 * section (experience, projects, education, certification).
 */

export interface FieldSpec {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "input" | "textarea" | "url";
}

export type EntryValues = Record<string, string | undefined>;

const KOSONG: ResumeFormState = { ok: false };

export function EntryDialog({
  title,
  description,
  fields,
  action,
  entry,
  triggerLabel,
  triggerIcon = "plus",
  triggerClassName,
}: {
  title: string;
  description?: string;
  fields: FieldSpec[];
  /** Server action bound with the section's signature. */
  action: (prev: ResumeFormState, formData: FormData) => Promise<ResumeFormState>;
  /** Existing values when editing; omit to add. */
  entry?: EntryValues & { id?: string };
  triggerLabel: string;
  triggerIcon?: "plus" | "pencil";
  triggerClassName?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ResumeFormState, FormData>(action, KOSONG);

  // Close on a successful save, and give the parent list a beat to refresh.
  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => setOpen(false), 350);
      return () => clearTimeout(t);
    }
  }, [state]);

  const Icon = triggerIcon === "pencil" ? Pencil : Plus;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName} aria-label={triggerLabel}>
          <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
          {triggerLabel ? <span>{triggerLabel}</span> : null}
        </button>
      </DialogTrigger>
      <DialogContent className="glass-card glass-card--strong max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border-white/70 backdrop-blur-xl sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-medium">{title}</DialogTitle>
          {description ? <DialogDescription className="text-sm text-gray-500">{description}</DialogDescription> : null}
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {entry?.id ? <input type="hidden" name="id" value={entry.id} /> : null}

          {fields.map((field) => {
            const value = entry?.[field.name] ?? "";
            const inputId = `${id}-${field.name}`;
            return (
              <div className="space-y-2" key={field.name}>
                <Label htmlFor={inputId}>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={inputId}
                    name={field.name}
                    placeholder={field.placeholder}
                    defaultValue={value}
                    required={field.required}
                  />
                ) : (
                  <Input
                    id={inputId}
                    name={field.name}
                    type="text"
                    placeholder={field.placeholder}
                    defaultValue={value}
                    required={field.required}
                  />
                )}
              </div>
            );
          })}

          {state.message ? (
            <p
              role="alert"
              className={
                state.ok
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                  : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              }
            >
              {state.message}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-800 hover:bg-gray-100"
              >
                Batal
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={pending}
              className="grad-btn inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A small destructive-submit button that posts a delete server action. */
export function HapusButton({
  action,
  id,
  label = "Hapus",
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label?: string;
}) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs font-medium text-red-600 hover:underline"
        aria-label={label}
      >
        {label}
      </button>
    </form>
  );
}

export const TRIGGER_CLASS =
  "grad-btn inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium";

export const EDIT_TRIGGER_CLASS =
  "inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800";
