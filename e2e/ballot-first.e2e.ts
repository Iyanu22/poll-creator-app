import { expect, test, type Page } from "@playwright/test";
import samplePolls from "../data/sample-polls.json";
import { POLL_CHANGED } from "../src/lib/realtime";
import {
  castVote,
  newPage,
  openGuestPizza,
  pizza,
  voteAsSomeoneElse,
} from "./helpers";

// The vote page's core promise, checked from outside like any visitor:
// until you vote on an open poll, no page, refetch or live update carries a
// count or a voter's name. Voting shows counts; closing shows names.
//
// It writes only to a throwaway guest's sandbox (swept after 24 hours): two
// ballots on its copy of pizza night, then End voting.

// Suggesters' names are public on purpose ("suggested by Priya"), and the
// creator's first name heads the page, so only the other voters can leak
const publicNames = new Set([
  samplePolls.creator.name,
  ...pizza.options.flatMap((o) => (o.suggestedBy ? [o.suggestedBy.name] : [])),
]);
const EARLY_VOTER = "Ballot Check B";
const WATCHER = "Ballot Check A";
const HIDDEN_NAMES = [
  ...new Set(pizza.votes.map((v) => v.voter.name)),
  EARLY_VOTER,
].filter((name) => !publicNames.has(name));

/** A count in raw page data: props, or rendered words like "5 of 13 votes". */
const COUNT_IN_DATA = [
  /"(votes|voters)":[1-9]/,
  /\b[1-9]\d* (of [1-9]\d* )?votes?\b/i,
];
/** A count in what the visitor sees (percentages only here: raw HTML has CSS). */
const COUNT_IN_TEXT = [...COUNT_IN_DATA, /\d+%/];

const named = (name: string) => new RegExp(`\\b${name}\\b`);
/** What matched, and in which response («refetch /p/…») if it was one. */
const leaks = (patterns: RegExp[], texts: string[]) =>
  texts.flatMap((text) => {
    const source = text.match(/^«(.*?)»/)?.[1];
    return patterns
      .flatMap((p) => text.match(p)?.[0] ?? [])
      .slice(0, 3)
      .map((match) => (source ? `${match} @ ${source}` : match));
  });

/**
 * Everything the server sends for the vote page (the page, its refetches,
 * the vote itself), plus Pusher's live messages. Not other pages the
 * browser prefetches: the landing page's example card has counts on purpose.
 * Responses are captured on their way through, before the page gets them:
 * reading them back from the browser afterwards can fail (Chrome may have
 * dropped a streamed body), and a body that isn't read can't be checked.
 */
async function watch(page: Page, origin: string, votePath: string) {
  let bodies: string[] = [];
  let frames: string[] = [];
  await page.route(
    (url) => url.origin === origin && url.pathname === votePath,
    async (route) => {
      const type = route.request().resourceType();
      if (type !== "document" && type !== "fetch") return route.continue();
      const response = await route.fetch({ maxRedirects: 0 });
      const body = await response.text();
      // Tagged with where it came from, for the failure message. Faces are
      // data URIs; their contents aren't the page's words.
      const { pathname } = new URL(route.request().url());
      const kind = route.request().headers()["next-action"]
        ? "vote"
        : route.request().headers()["rsc"]
          ? "refetch"
          : type;
      bodies.push(
        `«${kind} ${pathname}»` + body.replace(/data:[^"'\s)]+/g, ""),
      );
      // The body comes back decoded, so it's re-sent without its encoding
      const headers = { ...response.headers() };
      delete headers["content-encoding"];
      delete headers["content-length"];
      await route.fulfill({ status: response.status(), headers, body });
    },
  );
  page.on("websocket", (ws) => {
    // Pusher's, not the dev server's hot reload
    if (!/pusher\.com/.test(ws.url())) return;
    ws.on("framereceived", ({ payload }) => frames.push(String(payload)));
  });
  return {
    frames: () => frames,
    /** What arrived since the last drain. */
    drain() {
      const taken = { bodies, frames };
      bodies = [];
      frames = [];
      return taken;
    },
  };
}

async function until(check: () => boolean, ms: number) {
  for (const end = Date.now() + ms; Date.now() < end;) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

test("no count or name reaches a visitor before they vote", async ({
  browser,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;

  const { creator, votePath } = await openGuestPizza(browser);

  // ── 1. Not voted yet: the ballot, nothing else ──────────────────────
  const watcher = await newPage(browser);
  const seen = await watch(watcher, origin, votePath);
  await watcher.goto(votePath);
  await expect(
    watcher.getByRole("button", { name: /^Cast my vote/ }),
  ).toBeVisible();
  const live = await until(
    () => seen.frames().some((f) => f.includes("subscription_succeeded")),
    10_000,
  );
  test.info().annotations.push({
    type: "live updates",
    description: live ? "Pusher" : "polling fallback",
  });
  // The page as it first arrives, checked on its own
  const firstLoad = seen.drain();
  expect(
    firstLoad.bodies.some((b) => b.startsWith("«document")),
    "the page was captured",
  ).toBe(true);
  expect(leaks(COUNT_IN_DATA, firstLoad.bodies), "counts in the page").toEqual(
    [],
  );

  // Someone else votes while the watcher sits on the ballot. The live
  // update makes the watcher's page refetch; that refetch is checked too.
  let otherVoted = false;
  const refetched = watcher.waitForResponse(
    (res) =>
      otherVoted &&
      new URL(res.url()).pathname === votePath &&
      res.request().headers()["rsc"] === "1",
    { timeout: 20_000 },
  );
  await voteAsSomeoneElse(browser, votePath, EARLY_VOTER);
  otherVoted = true;
  await refetched;

  const before = seen.drain();
  const beforeText = [await watcher.locator("main").innerText()];
  expect(
    before.bodies.some((b) => b.startsWith("«refetch")),
    "the refetch was captured",
  ).toBe(true);
  expect(leaks(COUNT_IN_DATA, before.bodies), "counts in the refetch").toEqual(
    [],
  );
  expect(leaks(COUNT_IN_TEXT, beforeText), "counts on screen").toEqual([]);
  expect(
    leaks(HIDDEN_NAMES.map(named), [
      ...firstLoad.bodies,
      ...before.bodies,
      ...beforeText,
    ]),
    "voter names",
  ).toEqual([]);

  // Pusher only ever says "this poll changed"
  const events = before.frames
    .map((f) => JSON.parse(f) as { event: string; data?: unknown })
    .filter((f) => f.event === POLL_CHANGED);
  if (live) expect(events.length, "a live update arrived").toBeGreaterThan(0);
  for (const event of events) expect(event.data).toBe("{}");

  // ── 2. Voted, still open: counts, never names ───────────────────────
  await castVote(watcher, WATCHER);
  const voted = seen.drain();
  const votedText = [await watcher.locator("main").innerText()];
  // The control: the same detectors now find counts, so they aren't blind
  expect(
    leaks(COUNT_IN_DATA, voted.bodies).length,
    "counts in data",
  ).toBeGreaterThan(0);
  expect(
    leaks(COUNT_IN_TEXT, votedText).length,
    "counts on screen",
  ).toBeGreaterThan(0);
  expect(
    leaks(HIDDEN_NAMES.map(named), [...voted.bodies, ...votedText]),
    "voter names",
  ).toEqual([]);

  // ── 3. Closed: everything, names included ───────────────────────────
  await creator.getByRole("button", { name: "End voting" }).click();
  await expect(watcher.getByText(/^Voting's closed/)).toBeVisible({
    timeout: 20_000,
  });
  const closedText = [await watcher.locator("main").innerText()];
  expect(
    leaks(HIDDEN_NAMES.map(named), closedText).length,
    "names shown",
  ).toBeGreaterThan(0);

  // A latecomer who never voted gets the answer too
  const latecomer = await newPage(browser);
  await latecomer.goto(votePath);
  await expect(latecomer.getByText(/^Voting's closed/)).toBeVisible();
  const lateText = [await latecomer.locator("main").innerText()];
  expect(leaks(COUNT_IN_TEXT, lateText).length, "counts shown").toBeGreaterThan(
    0,
  );
});
