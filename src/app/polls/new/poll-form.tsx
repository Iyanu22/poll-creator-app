"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { validateDraft, type DraftErrors } from "@/domain/poll-draft";
import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  OPTION_LABEL_MAX,
  TITLE_MAX,
} from "@/domain/rules";
import {
  deadlinePresets,
  toLocalInputValue,
  type DeadlinePreset,
  type PresetId,
} from "@/lib/deadline-presets";
import { createPollAction } from "./actions";

const CREATE_PRESETS = ["1h", "tonight", "tomorrow", "3days"] as const;
const DEFAULT_PRESET: PresetId = "tomorrow";

const field =
  "min-h-12 w-full rounded-md border-2 border-cocoa bg-cream-bright px-3 text-md aria-invalid:border-tangerine-deep";
const errorText = "text-sm font-bold text-tangerine-deep";

/** Deliberately small: a question, 2–10 options, a deadline, two switches. */
export function PollForm() {
  const ids = useId();
  const [title, setTitle] = useState(useSearchParams().get("title") ?? "");
  // Stable keys for the rows; a per-form counter so server and browser agree
  const nextKey = useRef(MIN_OPTIONS);
  const [options, setOptions] = useState(() =>
    Array.from({ length: MIN_OPTIONS }, (_, key) => ({ key, value: "" })),
  );
  const [multi, setMulti] = useState(false);
  const [maxChoices, setMaxChoices] = useState(2);
  const [suggestions, setSuggestions] = useState(true);
  const [presets, setPresets] = useState<DeadlinePreset[] | null>(null);
  const [deadline, setDeadline] = useState<PresetId | "custom">(DEFAULT_PRESET);
  const [custom, setCustom] = useState("");
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Quick picks depend on the creator's own clock and timezone
  useEffect(() => {
    const now = new Date();
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only values */
    setPresets(deadlinePresets(now, CREATE_PRESETS));
    setCustom(
      toLocalInputValue(deadlinePresets(now, ["tomorrow"])[0].closesAt),
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const filled = options.filter((o) => o.value.trim()).length;
  const maxChoicesRange = Math.max(2, filled);

  const optionInput = (index: number) =>
    formRef.current?.querySelectorAll<HTMLInputElement>("[data-option]")[index];

  function setOption(index: number, value: string) {
    setOptions((list) =>
      list.map((o, i) => (i === index ? { ...o, value } : o)),
    );
    clearError("options");
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    // flushSync renders the new row now, so it can take focus right away
    // (waiting a frame loses keystrokes typed in between)
    flushSync(() =>
      setOptions((list) => [...list, { key: nextKey.current++, value: "" }]),
    );
    optionInput(options.length)?.focus();
  }

  function removeOption(index: number) {
    flushSync(() => {
      setOptions((list) => list.filter((_, i) => i !== index));
      // Per-field errors are keyed by position, which just shifted
      setErrors((e) => ({ ...e, optionFields: undefined }));
    });
    // Focus the field that slid into its place, or the new last one
    optionInput(Math.min(index, options.length - 2))?.focus();
  }

  function clearError(key: keyof DraftErrors) {
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function closesAt(): Date {
    if (deadline === "custom") return new Date(custom);
    return (
      presets?.find((p) => p.id === deadline)?.closesAt ?? new Date(Number.NaN)
    );
  }

  function focusFirstError(found: DraftErrors) {
    const form = formRef.current;
    if (!form) return;
    const firstOption = found.optionFields
      ? Number(Object.keys(found.optionFields)[0])
      : found.options
        ? 0
        : null;
    const target = found.title
      ? form.querySelector<HTMLElement>(`#${CSS.escape(`${ids}-title`)}`)
      : firstOption !== null
        ? optionInput(firstOption)
        : found.maxChoices
          ? form.querySelector<HTMLElement>(`#${CSS.escape(`${ids}-max`)}`)
          : found.closesAt
            ? form.querySelector<HTMLElement>(
                `[name="${ids}-deadline"]:checked`,
              )
            : null;
    target?.focus();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;
    const draft = {
      title,
      options: options.map((o) => o.value),
      type: multi ? ("multi" as const) : ("single" as const),
      maxChoices: multi ? maxChoices : 1,
      suggestionsEnabled: suggestions,
      closesAt: closesAt(),
    };
    const checked = validateDraft(draft, new Date());
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirstError(checked.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      // Redirects to the share step on success
      const result = await createPollAction({
        ...draft,
        closesAt: draft.closesAt.toISOString(),
      });
      if ("errors" in result) {
        setErrors(result.errors);
        focusFirstError(result.errors);
      } else {
        setFormError(result.message);
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-10"
    >
      {/* ── The question ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor={`${ids}-title`}
          className="font-display text-lg font-extrabold"
        >
          What are you deciding?
        </label>
        <input
          id={`${ids}-title`}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            clearError("title");
          }}
          onKeyDown={(e) => {
            // Enter moves on rather than submitting half a poll
            if (e.key === "Enter") {
              e.preventDefault();
              optionInput(0)?.focus();
            }
          }}
          maxLength={TITLE_MAX}
          placeholder="Pizza night: what are we ordering?"
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${ids}-title-error` : undefined}
          className={field}
        />
        {errors.title ? (
          <p id={`${ids}-title-error`} className={errorText}>
            {errors.title}
          </p>
        ) : null}
      </div>

      {/* ── Options ──────────────────────────────────────────────── */}
      <fieldset
        aria-describedby={
          errors.options ? `${ids}-options-error` : `${ids}-options-hint`
        }
        className="flex flex-col gap-3"
      >
        <legend className="mb-1 font-display text-lg font-extrabold">
          The options
        </legend>
        <p id={`${ids}-options-hint`} className="text-sm text-cocoa-soft">
          Between {MIN_OPTIONS} and {MAX_OPTIONS}. Press Enter in the last one
          to add another.
        </p>
        {errors.options ? (
          <p id={`${ids}-options-error`} className={errorText}>
            {errors.options}
          </p>
        ) : null}
        <ol className="flex flex-col gap-3">
          {options.map((option, index) => {
            const error = errors.optionFields?.[index];
            const inputId = `${ids}-option-${option.key}`;
            return (
              <li key={option.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <label htmlFor={inputId} className="sr-only">
                    Option {index + 1}
                  </label>
                  <span
                    aria-hidden="true"
                    className="w-6 shrink-0 text-right font-display font-bold text-cocoa-soft tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <input
                    id={inputId}
                    data-option
                    value={option.value}
                    onChange={(e) => {
                      setOption(index, e.target.value);
                      setErrors((x) => {
                        if (!x.optionFields?.[index]) return x;
                        const rest = { ...x.optionFields };
                        delete rest[index];
                        return { ...x, optionFields: rest };
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (index < options.length - 1)
                        optionInput(index + 1)?.focus();
                      else if (option.value.trim()) addOption();
                    }}
                    maxLength={OPTION_LABEL_MAX}
                    autoComplete="off"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    className={field}
                  />
                  {options.length > MIN_OPTIONS ? (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      aria-label={`Remove option ${index + 1}${option.value.trim() ? `: ${option.value.trim()}` : ""}`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-cocoa"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  ) : null}
                </div>
                {error ? (
                  <p id={`${inputId}-error`} className={`${errorText} pl-8`}>
                    {error}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
        {options.length < MAX_OPTIONS ? (
          <button
            type="button"
            onClick={addOption}
            className="min-h-11 self-start pl-8 font-bold underline"
          >
            Add another option
          </button>
        ) : (
          <p className="pl-8 text-sm text-cocoa-soft">
            That&apos;s the most a poll can have.
          </p>
        )}
      </fieldset>

      {/* ── When it closes ───────────────────────────────────────── */}
      <fieldset
        aria-describedby={errors.closesAt ? `${ids}-deadline-error` : undefined}
        className="flex flex-col gap-2"
      >
        <legend className="mb-3 font-display text-lg font-extrabold">
          When does voting close?
        </legend>
        {errors.closesAt ? (
          <p id={`${ids}-deadline-error`} className={errorText}>
            {errors.closesAt}
          </p>
        ) : null}
        {presets === null ? (
          <div aria-hidden="true" className="flex flex-col gap-2">
            {CREATE_PRESETS.map((id) => (
              <div key={id} className="h-12 rounded-full bg-cream-deep" />
            ))}
          </div>
        ) : (
          [...presets, null].map((preset) => {
            const id = preset?.id ?? "custom";
            return (
              <label
                key={id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-full border-2 border-cocoa bg-card px-4 has-checked:bg-teal-soft has-checked:ring-2 has-checked:ring-teal-deep"
              >
                <input
                  type="radio"
                  name={`${ids}-deadline`}
                  value={id}
                  checked={deadline === id}
                  onChange={() => {
                    setDeadline(id);
                    clearError("closesAt");
                  }}
                  className="accent-teal-deep"
                />
                {preset?.label ?? "Pick a date and time"}
              </label>
            );
          })
        )}
        {deadline === "custom" ? (
          <div className="flex flex-col gap-1.5 pt-2 pl-4">
            <label htmlFor={`${ids}-custom`} className="font-bold">
              Closes at (your time)
            </label>
            <input
              id={`${ids}-custom`}
              type="datetime-local"
              value={custom}
              min={toLocalInputValue(new Date())}
              onChange={(e) => {
                setCustom(e.target.value);
                clearError("closesAt");
              }}
              className={`${field} max-w-xs`}
            />
          </div>
        ) : null}
      </fieldset>

      {/* ── How it votes ─────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 font-display text-lg font-extrabold">
          House rules
        </legend>
        <Toggle
          checked={multi}
          onChange={(on) => {
            setMulti(on);
            clearError("maxChoices");
          }}
          label="Let people pick more than one"
          hint="Good for shortlists: each voter backs several options."
        />
        {multi ? (
          <div className="flex flex-col gap-1.5 pl-14">
            <label htmlFor={`${ids}-max`} className="font-bold">
              Up to
            </label>
            <select
              id={`${ids}-max`}
              value={maxChoices}
              onChange={(e) => {
                setMaxChoices(Number(e.target.value));
                clearError("maxChoices");
              }}
              aria-invalid={errors.maxChoices ? true : undefined}
              aria-describedby={
                errors.maxChoices ? `${ids}-max-error` : undefined
              }
              className={`${field} max-w-40`}
            >
              {Array.from({ length: maxChoicesRange - 1 }, (_, i) => i + 2).map(
                (n) => (
                  <option key={n} value={n}>
                    {n} picks
                  </option>
                ),
              )}
            </select>
            {errors.maxChoices ? (
              <p id={`${ids}-max-error`} className={errorText}>
                {errors.maxChoices}
              </p>
            ) : null}
          </div>
        ) : null}
        <Toggle
          checked={suggestions}
          onChange={setSuggestions}
          label="Let voters suggest options"
          hint="You approve each one before it joins the ballot."
        />
      </fieldset>

      {formError ? (
        <p role="alert" className="rounded-md bg-cream-deep px-4 py-3">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        aria-disabled={isPending}
        aria-busy={isPending}
        className="min-h-14 rounded-full bg-teal px-6 font-display text-md font-bold text-cream-bright shadow-press-teal aria-disabled:opacity-60"
      >
        {isPending ? "Creating…" : "Create poll"}
      </button>
    </form>
  );
}

/** A checkbox styled as a switch: same semantics, bigger target. */
function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-hint`}
        className="peer mt-0.5 h-7 w-11 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-cocoa bg-cream-deep transition-colors before:block before:size-5 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-cocoa before:transition-transform checked:bg-teal checked:before:translate-x-[1.1rem] checked:before:bg-cream-bright"
      />
      <label htmlFor={id} className="flex cursor-pointer flex-col">
        <span className="font-bold">{label}</span>
        <span id={`${id}-hint`} className="text-sm text-cocoa-soft">
          {hint}
        </span>
      </label>
    </div>
  );
}
