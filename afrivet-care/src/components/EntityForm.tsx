"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveAction, type FormState, type SaveTarget } from "@/app/actions";
import type { Field } from "@/lib/schema";

interface Props {
  target: SaveTarget;
  fields: readonly Field[];
  pets?: { id: string; name: string }[];
  /** Pre-filled values (editing, or a fixed pet). */
  initial?: Record<string, string | number | null | undefined>;
  /** Field names sent as hidden inputs instead of being shown. */
  hidden?: string[];
  submitLabel: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function EntityForm({ target, fields, pets = [], initial = {}, hidden = [], submitLabel }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAction.bind(null, target), {});
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.errors ?? {};

  // After a failed save, focus the first field that needs fixing.
  useEffect(() => {
    const first = Object.keys(errors)[0];
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const valueOf = (name: string) => {
    // After a failed save show what the user typed; otherwise the starting values.
    const v = state.values?.[name] ?? initial[name];
    return v === null || v === undefined ? "" : String(v);
  };

  return (
    // The key remounts the form after each submit so inputs show the right values.
    <form ref={formRef} action={action} className="form" key={state.savedAt ?? JSON.stringify(state.values ?? {})} noValidate>
      {errors._ && <p className="form-error" role="alert">{errors._}</p>}
      {fields.map((f) => {
        if (hidden.includes(f.name)) return <input key={f.name} type="hidden" name={f.name} value={valueOf(f.name)} />;
        const id = `${target.table}-${f.name}`;
        const common = {
          id,
          name: f.name,
          required: f.required,
          defaultValue: valueOf(f.name),
          "aria-invalid": errors[f.name] ? true : undefined,
          "aria-describedby": errors[f.name] ? `${id}-error` : undefined,
        };
        return (
          <div key={f.name} className={`field${f.type === "longtext" ? " field-wide" : ""}`}>
            <label htmlFor={id}>
              {f.label}
              {!f.required && <span className="optional"> (optional)</span>}
            </label>
            {f.type === "select" || f.type === "pet" ? (
              <select {...common}>
                <option value="">Choose…</option>
                {f.type === "pet"
                  ? pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                  : f.options?.map((o) => <option key={o} value={o}>{cap(o)}</option>)}
              </select>
            ) : f.type === "longtext" ? (
              <textarea {...common} rows={3} maxLength={f.max} />
            ) : (
              <input
                {...common}
                type={f.type === "datetime" ? "datetime-local" : f.type}
                inputMode={f.type === "number" ? "decimal" : undefined}
                step={f.type === "number" ? "0.01" : undefined}
                min={f.type === "number" ? 0 : undefined}
                maxLength={f.type === "text" ? f.max : undefined}
                placeholder={f.placeholder}
                autoComplete="off"
              />
            )}
            {errors[f.name] && <p className="field-error" id={`${id}-error`}>{errors[f.name]}</p>}
          </div>
        );
      })}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state.savedAt && <span className="saved" role="status">Saved ✓</span>}
      </div>
    </form>
  );
}
