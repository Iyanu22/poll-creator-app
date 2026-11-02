"use client";

import { useId, useRef, useState, useTransition } from "react";
import { OPTION_LABEL_MAX, VOTER_NAME_MAX } from "@/domain/rules";
import { suggestAction } from "./actions";
import { saveIdentity, type VoterIdentity } from "./identity";

const field =
  "min-h-11 w-full rounded-md border-2 border-cocoa bg-cream-bright px-3 aria-invalid:border-tangerine-deep";

/**
 * "Suggest something else": a real modal (native <dialog>: focus trapped,
 * Escape closes, focus returns to the trigger). Uses the voter's identity
 * when they've given one; otherwise asks for a name here too.
 */
export function SuggestDialog({
  pollId,
  creatorFirstName,
  identity,
}: {
  pollId: string;
  creatorFirstName: string;
  /** Name may be empty if the voter hasn't typed it yet. */
  identity: VoterIdentity;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sentRef = useRef<HTMLParagraphElement>(null);
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ids = useId();
  const needsName = identity.name.trim() === "";

  function open() {
    setLabel("");
    setName("");
    setError(null);
    setSent(false);
    dialogRef.current?.showModal();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;
    const voter = {
      ...identity,
      name: needsName ? name.trim() : identity.name,
    };
    if (!label.trim()) return setError("Write your suggestion first.");
    if (!voter.name) return setError("Add your name so they know it's you.");

    setError(null);
    startTransition(async () => {
      const result = await suggestAction(pollId, { ...voter, label });
      if (!result.ok) return setError(result.message);
      saveIdentity(voter);
      setSent(true);
      requestAnimationFrame(() => sentRef.current?.focus());
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="min-h-11 self-start font-bold underline"
      >
        Suggest something else
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${ids}-heading`}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border-[length:var(--border-card)] border-cocoa bg-card p-6 text-cocoa backdrop:bg-cocoa/40"
      >
        {sent ? (
          <div className="flex flex-col gap-5">
            <h2
              id={`${ids}-heading`}
              className="font-display text-xl font-extrabold"
            >
              Suggestion sent
            </h2>
            <p ref={sentRef} tabIndex={-1}>
              Sent to {creatorFirstName}. If they add it, it&apos;ll show up on
              the ballot.
            </p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="min-h-11 self-end rounded-full bg-cocoa px-5 font-display font-bold text-cream-bright"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <h2
              id={`${ids}-heading`}
              className="font-display text-xl font-extrabold"
            >
              Suggest something else
            </h2>
            <p className="text-sm text-cocoa-soft">
              {creatorFirstName} decides whether it joins the ballot. If it
              does, it starts with 0 votes.
            </p>
            <label className="flex flex-col gap-1.5 font-bold">
              Your suggestion
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={OPTION_LABEL_MAX}
                required
                autoComplete="off"
                className={field}
              />
            </label>
            {needsName ? (
              <label className="flex flex-col gap-1.5 font-bold">
                Your name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={VOTER_NAME_MAX}
                  required
                  autoComplete="given-name"
                  className={field}
                />
              </label>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="min-h-11 rounded-full border-2 border-cocoa px-5 font-display font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                aria-disabled={isPending}
                aria-busy={isPending}
                className="min-h-11 rounded-full bg-cocoa px-5 font-display font-bold text-cream-bright aria-disabled:opacity-60"
              >
                Send it
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
