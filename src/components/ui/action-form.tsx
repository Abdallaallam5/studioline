"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { createContext, useContext, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { cn, type ActionState } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";
import { useModalClose } from "./modal";
import { toast } from "./toast";
import { useT } from "@/lib/i18n/client";

export type FormAction = (formData: FormData) => Promise<ActionState>;

interface FormContextValue {
  state: ActionState;
  pending: boolean;
  /** Increments after every successful submit; stateful fields reset on change. */
  resetKey: number;
}

const FormContext = createContext<FormContextValue>({ state: {}, pending: false, resetKey: 0 });
export const useFormContext = () => useContext(FormContext);

interface ActionFormProps {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Hidden inputs sent with the form (ids, tokens). */
  hidden?: Record<string, string>;
  onSuccess?: () => void;
  /** Keep field values after a successful submit (edit forms). */
  keepValues?: boolean;
  /** Show the success message inline instead of as a toast (public pages). */
  inlineSuccess?: boolean;
}

/**
 * Form wired to a server action. Shows validation errors next to fields,
 * surfaces failures, toasts successes, and closes the surrounding modal.
 * Inputs keep their values when the action fails.
 */
export function ActionForm({ action, children, className, hidden, onSuccess, keepValues, inlineSuccess }: ActionFormProps) {
  const t = useT();
  const [state, setState] = useState<ActionState>({});
  const [resetKey, setResetKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const closeModal = useModalClose();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    // Passing the submitter includes the clicked button's name/value (e.g. approve vs. request changes).
    const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    // FileUploader adds this marker while an upload is still in flight.
    if (formData.has("__uploading")) {
      setState({ ok: false, error: t("Please wait for your files to finish uploading.") });
      return;
    }
    startTransition(async () => {
      let result: ActionState | undefined;
      try {
        result = await action(formData);
      } catch {
        result = { ok: false, error: t("Could not reach the server. Check your connection and try again.") };
      }
      if (!result) return; // the action redirected
      setState(result);
      if (result.ok) {
        if (result.share) toast.share(result.message ?? "", result.share);
        else if (result.message && !inlineSuccess) toast.success(result.message);
        if (!keepValues) {
          formRef.current?.reset();
          setResetKey((k) => k + 1);
        }
        onSuccess?.();
        closeModal?.();
      }
    });
  }

  return (
    <FormContext.Provider value={{ state, pending, resetKey }}>
      <form ref={formRef} onSubmit={onSubmit} className={className} noValidate>
        {hidden && Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        {state.error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-danger-soft px-3 py-2.5 text-[13px] leading-snug text-danger">
            <CircleAlert className="mt-px size-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        {inlineSuccess && state.ok && state.message && (
          <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-brand-soft px-3 py-2.5 text-[13px] leading-snug text-brand">
            {state.message}
          </div>
        )}
        {children}
      </form>
    </FormContext.Provider>
  );
}

interface FieldProps {
  label: string;
  /** Must match the control's `name` so server-side errors land here. */
  name: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  /** Use "div" for composite controls (checkbox lists, uploaders) that must not sit inside a <label>. */
  as?: "label" | "div";
  children: ReactNode;
}

/**
 * Label + control + hint + server validation error. The control is wrapped by
 * the label, so no id wiring is needed and it works from server components.
 */
export function Field({ label, name, hint, optional, className, as = "label", children }: FieldProps) {
  const t = useT();
  const { state } = useFormContext();
  const error = state.fieldErrors?.[name]?.[0];
  const Wrapper = as;

  return (
    <Wrapper data-invalid={error ? "true" : undefined} className={cn("group/field block space-y-1.5", className)}>
      <span className="block text-[13px] font-medium text-ink">
        {label}
        {optional && <span className="ms-1.5 font-normal text-muted">{t("Optional")}</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="block text-xs text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="block text-xs leading-snug text-muted">{hint}</span>
      ) : null}
    </Wrapper>
  );
}

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormContext();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <LoaderCircle className="animate-spin" />}
      {children}
    </Button>
  );
}

interface ActionButtonProps extends Omit<ButtonProps, "onClick"> {
  action: FormAction;
  fields?: Record<string, string>;
  /** Ask before running (destructive or hard-to-undo actions). */
  confirm?: string;
  onDone?: () => void;
}

/** A button that runs a server action with fixed fields and reports the result. */
export function ActionButton({ action, fields, confirm, onDone, children, ...props }: ActionButtonProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (confirm && !window.confirm(confirm)) return;
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields ?? {})) formData.set(key, value);
    startTransition(async () => {
      let result: ActionState | undefined;
      try {
        result = await action(formData);
      } catch {
        result = { ok: false, error: t("Could not reach the server. Check your connection and try again.") };
      }
      if (!result) return;
      if (result.ok) {
        if (result.share) toast.share(result.message ?? "", result.share);
        else if (result.message) toast.success(result.message);
        onDone?.();
      } else {
        toast.error(result.error ?? t("Something went wrong"));
      }
    });
  }

  return (
    <Button onClick={onClick} disabled={pending || props.disabled} {...props}>
      {pending && <LoaderCircle className="animate-spin" />}
      {children}
    </Button>
  );
}
