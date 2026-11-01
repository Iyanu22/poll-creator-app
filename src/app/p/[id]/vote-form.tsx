"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  AVATAR_TINTS,
  AVATAR_TINT_NAMES,
  VOTER_NAME_MAX,
  type AvatarTint,
} from "@/domain/rules";
import { castVoteAction } from "./actions";
import {
  justVotedKey,
  loadIdentity,
  saveIdentity,
  type FaceOption,
  type VoterFace,
} from "./identity";
import { SuggestDialog } from "./suggest-dialog";

export interface BallotChoice {
  id: string;
  label: string;
  suggestedByName: string | null;
  /** Pre-rendered on the server. */
  suggestedByAvatar: React.ReactNode;
}

interface Errors {
  name?: string;
  selection?: string;
}

function listLabels(labels: string[]) {
  return labels.length <= 2
    ? labels.join(" and ")
    : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * Identity first, then the ballot, everything funnelling to one action.
 * The ballot ships unselected; casting is final, so it gets a confirmation.
 */
export function VoteForm({
  pollId,
  type,
  maxChoices,
  creatorFirstName,
  suggestionsEnabled,
  choices,
  faces,
}: {
  pollId: string;
  type: "single" | "multi";
  maxChoices: number;
  creatorFirstName: string;
  suggestionsEnabled: boolean;
  choices: BallotChoice[];
  faces: FaceOption[];
}) {
  const ids = useId();
  const [name, setName] = useState("");
  const [face, setFace] = useState<VoterFace>(faces[0].seed);
  const [tint, setTint] = useState<AvatarTint>(AVATAR_TINTS[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [castError, setCastError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const ballotRef = useRef<HTMLFieldSetElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);

  // Remembered from this device's last vote, if any
  useEffect(() => {
    const saved = loadIdentity();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from localStorage, which the server can't read */
    if (saved.name) setName(saved.name);
    if (saved.avatarSeed) setFace(saved.avatarSeed);
    if (saved.avatarTint) setTint(saved.avatarTint);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const multi = type === "multi";
  const chosenLabels = choices
    .filter((c) => selected.includes(c.id))
    .map((c) => c.label);
  const ready = name.trim() !== "" && selected.length > 0;
  const castLabel = chosenLabels.length
    ? `Cast my vote for ${listLabels(chosenLabels)}`
    : "Cast my vote";
  const faceSrc = faces.find((f) => f.seed === face)?.src ?? null;
  const identity = { name: name.trim(), avatarSeed: face, avatarTint: tint };

  function toggle(id: string) {
    setErrors((e) => ({ ...e, selection: undefined }));
    if (!multi) return setSelected([id]);
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < maxChoices
          ? [...current, id]
          : current,
    );
  }

  function requestCast() {
    const next: Errors = {};
    if (!name.trim()) next.name = "Add your name so the crew knows it's you.";
    if (selected.length === 0) {
      next.selection = multi ? "Pick at least one option." : "Pick an option.";
    }
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.selection) {
      return ballotRef.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus();
    }
    setCastError(null);
    confirmRef.current?.showModal();
  }

  function cast() {
    if (isPending) return;
    startTransition(async () => {
      sessionStorage.setItem(justVotedKey(pollId), "1");
      const result = await castVoteAction(pollId, {
        ...identity,
        optionIds: selected,
      });
      if (!result.ok) {
        sessionStorage.removeItem(justVotedKey(pollId));
        setCastError(result.message);
        return;
      }
      saveIdentity(identity);
      // The refreshed page replaces this form with the voted view
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Who's voting ─────────────────────────────────────────── */}
      <section aria-labelledby={`${ids}-who`} className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <FacePreview src={faceSrc} tint={tint} name={name} size={64} />
          <h2 id={`${ids}-who`} className="font-display text-lg font-extrabold">
            {name.trim() ? `Hi, ${name.trim()}` : "Who's voting?"}
          </h2>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-name`} className="font-bold">
            Your name
          </label>
          <input
            ref={nameRef}
            id={`${ids}-name`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((x) => ({ ...x, name: undefined }));
            }}
            maxLength={VOTER_NAME_MAX}
            autoComplete="given-name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${ids}-name-error` : undefined}
            className="min-h-12 rounded-md border-2 border-cocoa bg-cream-bright px-3 text-md aria-invalid:border-tangerine-deep"
          />
          {errors.name ? (
            <p
              id={`${ids}-name-error`}
              className="text-sm font-bold text-tangerine-deep"
            >
              {errors.name}
            </p>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">Pick your face</legend>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {faces.map((option, i) => (
              <label
                key={option.seed}
                className="relative flex aspect-square cursor-pointer items-center justify-center rounded-full has-checked:ring-4 has-checked:ring-teal-deep has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal"
              >
                <input
                  type="radio"
                  name={`${ids}-face`}
                  value={option.seed}
                  checked={face === option.seed}
                  onChange={() => setFace(option.seed)}
                  className="peer sr-only"
                />
                <span className="sr-only">Face {i + 1}</span>
                <FacePreview
                  src={option.src}
                  tint={tint}
                  name={name}
                  size="100%"
                />
                <CheckBadge />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">Background</legend>
          <div className="flex gap-3">
            {AVATAR_TINTS.map((t) => (
              <label
                key={t}
                className="relative flex size-11 cursor-pointer rounded-full border-2 border-cocoa has-checked:ring-4 has-checked:ring-teal-deep has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal"
                style={{ backgroundColor: `#${t}` }}
              >
                <input
                  type="radio"
                  name={`${ids}-tint`}
                  value={t}
                  checked={tint === t}
                  onChange={() => setTint(t)}
                  className="peer sr-only"
                />
                <span className="sr-only">{AVATAR_TINT_NAMES[t]}</span>
                <CheckBadge />
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* ── The ballot ───────────────────────────────────────────── */}
      <fieldset
        ref={ballotRef}
        aria-describedby={errors.selection ? `${ids}-ballot-error` : undefined}
        className="flex flex-col gap-3"
      >
        <legend className="mb-3 font-display text-lg font-extrabold">
          {multi ? `Pick up to ${maxChoices}` : "Your pick"}
        </legend>
        {errors.selection ? (
          <p
            id={`${ids}-ballot-error`}
            className="text-sm font-bold text-tangerine-deep"
          >
            {errors.selection}
          </p>
        ) : null}
        {choices.map((choice) => {
          const checked = selected.includes(choice.id);
          const full = multi && !checked && selected.length >= maxChoices;
          return (
            <label
              key={choice.id}
              className="flex min-h-14 cursor-pointer items-center gap-4 rounded-lg border-[length:var(--border-card)] border-cocoa bg-card px-5 py-3 has-checked:bg-teal-soft has-checked:ring-4 has-checked:ring-teal-deep has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal has-disabled:cursor-not-allowed has-disabled:opacity-60"
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={`${ids}-ballot`}
                value={choice.id}
                checked={checked}
                disabled={full}
                onChange={() => toggle(choice.id)}
                aria-invalid={errors.selection ? true : undefined}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex size-7 shrink-0 items-center justify-center border-2 border-cocoa bg-cream-bright font-bold text-cream-bright peer-checked:border-teal-deep peer-checked:bg-teal-deep ${multi ? "rounded-md" : "rounded-full"}`}
              >
                {checked ? "✓" : null}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-display text-md font-bold break-words">
                  {choice.label}
                </span>
                {choice.suggestedByName ? (
                  <span className="inline-flex items-center gap-2 text-xs text-cocoa-soft">
                    {choice.suggestedByAvatar}
                    Suggested by {choice.suggestedByName}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
        {multi && selected.length >= maxChoices ? (
          <p className="text-sm text-cocoa-soft">
            That&apos;s your {maxChoices}. Unpick one to change your mind.
          </p>
        ) : null}
      </fieldset>

      {suggestionsEnabled ? (
        <SuggestDialog
          pollId={pollId}
          creatorFirstName={creatorFirstName}
          identity={identity}
        />
      ) : null}

      {/* Stays reachable while a long ballot scrolls on a phone */}
      <div className="sticky bottom-0 -mx-6 border-t-2 border-cream-deep bg-cream/95 px-6 py-4 backdrop-blur-sm">
        <button
          type="button"
          onClick={requestCast}
          // aria-disabled, not disabled: pressing it early explains what's
          // missing and moves focus there
          aria-disabled={!ready}
          className="min-h-14 w-full rounded-full bg-tangerine-deep px-6 font-display text-md font-bold break-words text-cream-bright shadow-press-tangerine aria-disabled:opacity-60"
        >
          {castLabel}
        </button>
      </div>

      <dialog
        ref={confirmRef}
        aria-labelledby={`${ids}-confirm`}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border-[length:var(--border-card)] border-cocoa bg-card p-6 text-cocoa backdrop:bg-cocoa/40"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <FacePreview src={faceSrc} tint={tint} name={name} size={56} />
            <h2
              id={`${ids}-confirm`}
              className="font-display text-xl font-extrabold"
            >
              Lock it in?
            </h2>
          </div>
          <p>
            You&apos;re voting for <strong>{listLabels(chosenLabels)}</strong>.
            No takebacks: once it&apos;s in, it&apos;s in.
          </p>
          {castError ? <p role="alert">{castError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => confirmRef.current?.close()}
              className="min-h-11 rounded-full border-2 border-cocoa px-5 font-display font-bold"
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={cast}
              aria-disabled={isPending}
              aria-busy={isPending}
              className="min-h-11 rounded-full bg-tangerine-deep px-5 font-display font-bold text-cream-bright shadow-press-tangerine aria-disabled:opacity-60"
            >
              {isPending ? "Casting…" : "Cast it"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function FacePreview({
  src,
  tint,
  name,
  size,
}: {
  src: string | null;
  tint: AvatarTint;
  name: string;
  size: number | string;
}) {
  const style = { width: size, height: size, backgroundColor: `#${tint}` };
  const frame = "shrink-0 rounded-full border-2 border-cocoa";
  if (!src) {
    return (
      <span
        aria-hidden="true"
        style={style}
        className={`${frame} flex items-center justify-center font-display font-bold`}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- inline data URI
  return <img src={src} alt="" style={style} className={frame} />;
}

function CheckBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-1 hidden size-6 items-center justify-center rounded-full border-2 border-cocoa bg-teal-deep text-xs font-bold text-cream-bright peer-checked:flex"
    >
      ✓
    </span>
  );
}
