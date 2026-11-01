"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  approveSuggestionAction,
  declineSuggestionAction,
  undoDeclineAction,
  type ActionResult,
} from "./actions";

export interface PendingItem {
  id: string;
  label: string;
  authorName: string;
  /** Pre-rendered on the server (DiceBear runs there). */
  avatar: React.ReactNode;
}

/** Matches the toast; the server allows a little longer (rules.ts). */
const UNDO_TOAST_MS = 8000;

/** Where focus goes once a moderation outcome shows up on screen. */
type FocusIntent =
  | { kind: "removed"; id: string; index: number }
  | { kind: "restored"; id: string };

export function PendingSuggestions({
  pollId,
  pending,
  fallbackFocusId,
}: {
  pollId: string;
  pending: PendingItem[];
  /** Where focus goes when the last pending card disappears. */
  fallbackFocusId: string;
}) {
  const [, startTransition] = useTransition();
  // Our own busy flags, not the transition's: the transition also covers
  // the page refresh, and Undo must work as soon as the decline has landed.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState<PendingItem | null>(null);
  const focusNext = useRef<FocusIntent | null>(null);

  // The refreshed list and our success callback can land in either order,
  // so focus is applied from both, against what's actually in the DOM.
  const applyFocus = () => {
    const intent = focusNext.current;
    if (!intent) return;
    const cards = [
      ...document.querySelectorAll<HTMLElement>("[data-pending-card]"),
    ];
    const card = (id: string) =>
      cards.find((c) => c.dataset.pendingCard === id);

    if (intent.kind === "restored") {
      const target = card(intent.id);
      if (!target) return; // not back yet
      focusNext.current = null;
      target.focus();
    } else {
      if (card(intent.id)) return; // not gone yet
      focusNext.current = null;
      const next = cards[Math.min(intent.index, cards.length - 1)];
      (next ?? document.getElementById(fallbackFocusId))?.focus();
    }
  };
  useEffect(applyFocus, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  function run(
    action: () => Promise<ActionResult>,
    onSuccess: () => void,
    onSettled: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      onSettled();
      if (!result.ok) return setError(result.message);
      onSuccess();
      applyFocus();
    });
  }

  function approve(item: PendingItem, index: number) {
    if (busyId) return;
    setBusyId(item.id);
    run(
      () => approveSuggestionAction(pollId, item.id),
      () => {
        focusNext.current = { kind: "removed", id: item.id, index };
        setAnnouncement(`${item.label} added to the ballot with 0 votes.`);
      },
      () => setBusyId(null),
    );
  }

  function decline(item: PendingItem, index: number) {
    if (busyId) return;
    setBusyId(item.id);
    run(
      () => declineSuggestionAction(pollId, item.id),
      () => {
        focusNext.current = { kind: "removed", id: item.id, index };
        setDeclined(item);
        setAnnouncement(
          `Declined ${item.authorName}'s suggestion, ${item.label}. Undo is available for a few seconds.`,
        );
      },
      () => setBusyId(null),
    );
  }

  function undo(item: PendingItem) {
    if (undoing) return;
    setUndoing(true);
    run(
      () => undoDeclineAction(pollId, item.id),
      () => {
        focusNext.current = { kind: "restored", id: item.id };
        setDeclined(null);
        setAnnouncement(
          `${item.authorName}'s suggestion is back in your queue.`,
        );
      },
      () => setUndoing(false),
    );
  }

  return (
    <>
      {pending.length > 0 ? (
        <section
          aria-labelledby="pending-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="pending-heading" className="sr-only">
            Suggestions waiting for you
          </h2>
          {pending.map((item, index) => (
            <article
              key={item.id}
              data-pending-card={item.id}
              tabIndex={-1}
              aria-labelledby={`pending-${item.id}`}
              className="flex flex-col gap-4 rounded-lg border-[length:var(--border-card)] border-cocoa bg-card p-5 sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 items-start gap-4">
                {item.avatar}
                <div className="flex flex-col gap-1">
                  <h3
                    id={`pending-${item.id}`}
                    className="font-display text-md font-bold"
                  >
                    {item.authorName} suggested: “{item.label}”
                  </h3>
                  <p className="text-sm text-cocoa-soft">
                    Approve it and it joins with 0 votes. Your call, house
                    rules.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => approve(item, index)}
                  // aria-disabled, not disabled: a disabled button drops
                  // focus to <body> while the action runs
                  aria-disabled={busyId !== null}
                  aria-busy={busyId === item.id}
                  className="min-h-11 rounded-full bg-teal px-5 font-display text-base font-bold text-cream-bright shadow-press-teal aria-disabled:opacity-60"
                >
                  Add it
                </button>
                <button
                  type="button"
                  onClick={() => decline(item, index)}
                  aria-disabled={busyId !== null}
                  className="min-h-11 rounded-full border-2 border-cocoa px-5 font-display text-base font-bold aria-disabled:opacity-60"
                >
                  Not this time
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-cream-deep px-4 py-3">
          {error}
        </p>
      ) : null}

      {/* One status region for moderation outcomes */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {declined ? (
        <UndoToast
          key={declined.id}
          message={`Declined ${declined.authorName}'s suggestion`}
          onUndo={() => undo(declined)}
          onDismiss={() => setDeclined(null)}
          busy={undoing}
        />
      ) : null}
    </>
  );
}

function UndoToast({
  message,
  onUndo,
  onDismiss,
  busy,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Parent re-renders must not restart the countdown
  const expire = useEffectEvent(onDismiss);

  // Hides itself after a while, but never while someone is using it
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (ref.current?.contains(document.activeElement)) schedule();
        else expire();
      }, UNDO_TOAST_MS);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={ref}
      className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-md items-center gap-3 rounded-full bg-cocoa py-2 pr-2 pl-5 text-cream-bright"
    >
      <p className="flex-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={onUndo}
        aria-disabled={busy}
        aria-busy={busy}
        className="min-h-11 rounded-full bg-cream-bright px-4 font-display text-sm font-bold text-cocoa aria-disabled:opacity-60"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex size-11 items-center justify-center rounded-full"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
