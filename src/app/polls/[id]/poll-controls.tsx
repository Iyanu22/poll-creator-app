"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  CopyLinkButton,
  CopyResultButton,
} from "@/components/copy-link-button";
import { deadlinePresets, type DeadlinePreset } from "@/lib/deadline-presets";
import { endVotingAction, reopenVotingAction } from "./actions";

const subscribe = () => () => {};
const primary =
  "min-h-11 rounded-full bg-cocoa px-5 font-display text-base font-bold text-cream-bright shadow-press-cocoa";
const secondary =
  "min-h-11 rounded-full border-2 border-cocoa bg-card px-5 font-display text-base font-bold aria-disabled:opacity-60";

/**
 * The share dock: the link, then End voting or Reopen voting. Stays mounted
 * across the status change so it can put focus somewhere deliberate when the
 * button the creator just pressed disappears.
 */
export function PollControls({
  pollId,
  status,
  resultText,
  titleId,
}: {
  pollId: string;
  status: "open" | "settled";
  /** Copy result payload; settled polls only. */
  resultText: string | null;
  titleId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const changedByMe = useRef(false);
  const path = `/p/${pollId}`;
  const host = useSyncExternalStore(
    subscribe,
    () => window.location.host,
    () => "",
  );

  useEffect(() => {
    if (!changedByMe.current) return;
    changedByMe.current = false;
    document.getElementById(titleId)?.focus();
  }, [status, titleId]);

  function endVoting() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await endVotingAction(pollId);
      if (!result.ok) return setError(result.message);
      changedByMe.current = true;
      setAnnouncement("Voting ended. The results are final unless you reopen.");
    });
  }

  return (
    <section aria-label="Share and manage" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-[2rem] bg-cream-deep p-3 pl-5">
        <p className="flex min-w-0 flex-1 basis-60 items-baseline gap-2 text-sm">
          <span className="shrink-0 text-cocoa-soft">
            {status === "open" ? "Anyone with the link can vote:" : "Link:"}
          </span>
          {/* Long links truncate; the Copy button is the real affordance */}
          <span className="truncate font-bold">
            {host}
            {path}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {status === "open" ? (
            <button
              type="button"
              onClick={endVoting}
              aria-disabled={isPending}
              aria-busy={isPending}
              className={secondary}
            >
              End voting
            </button>
          ) : (
            <ReopenVoting
              pollId={pollId}
              onReopened={() => {
                changedByMe.current = true;
                setAnnouncement("Voting reopened.");
              }}
            />
          )}
          {resultText ? (
            <>
              <CopyLinkButton path={path} className={secondary} />
              <CopyResultButton text={resultText} className={primary} />
            </>
          ) : (
            <CopyLinkButton path={path} className={primary} />
          )}
        </div>
      </div>
      {status === "open" ? (
        <p className="px-5 text-xs text-cocoa-soft">
          Ending early isn&apos;t final: you can reopen voting later if the crew
          changes its mind.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="px-5 text-sm">
          {error}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

/** Reopening needs a new deadline: an open poll always has a future one. */
const REOPEN_PRESETS = ["1h", "3h", "tonight", "tomorrow"] as const;

function ReopenVoting({
  pollId,
  onReopened,
}: {
  pollId: string;
  onReopened: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<DeadlinePreset[]>([]);
  const [choice, setChoice] = useState("1h");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open() {
    // Computed on open, in the creator's own timezone
    setOptions(deadlinePresets(new Date(), REOPEN_PRESETS));
    setChoice("1h");
    setError(null);
    dialogRef.current?.showModal();
  }

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;
    const preset = options.find((p) => p.id === choice);
    if (!preset) return;
    startTransition(async () => {
      const result = await reopenVotingAction(
        pollId,
        preset.closesAt.toISOString(),
      );
      if (!result.ok) return setError(result.message);
      onReopened();
      dialogRef.current?.close();
    });
  }

  return (
    <>
      <button type="button" onClick={open} className={secondary}>
        Reopen voting
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="reopen-heading"
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border-[length:var(--border-card)] border-cocoa bg-card p-6 text-cocoa backdrop:bg-cocoa/40"
      >
        <form onSubmit={confirm} className="flex flex-col gap-5">
          <h2
            id="reopen-heading"
            className="font-display text-xl font-extrabold"
          >
            Reopen voting?
          </h2>
          <p className="text-sm text-cocoa-soft">
            The result stops being final and your crew can vote again. Votes
            already cast stay as they are.
          </p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-bold">Close voting again</legend>
            {options.map((preset) => (
              <label
                key={preset.id}
                className="flex min-h-11 items-center gap-3 rounded-full border-2 border-cocoa px-4 has-checked:bg-teal-soft"
              >
                <input
                  type="radio"
                  name="closes"
                  value={preset.id}
                  checked={choice === preset.id}
                  onChange={() => setChoice(preset.id)}
                  className="accent-teal-deep"
                />
                {preset.label}
              </label>
            ))}
          </fieldset>
          {error ? <p role="alert">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={secondary}
            >
              Keep it settled
            </button>
            <button
              type="submit"
              aria-disabled={isPending}
              aria-busy={isPending}
              className={primary}
            >
              Reopen voting
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
