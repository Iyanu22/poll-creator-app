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
const leaks = (patterns: RegExp[], texts: string[]) =>
  texts.flatMap((text) =>
    patterns.flatMap((p) => text.match(p)?.[0] ?? []).slice(0, 3),
  );

/** Everything the server sends this page, plus Pusher's live messages. */
function watch(page: Page, origin: string) {
  let bodies: Promise<string>[] = [];
  let frames: string[] = [];
  page.on("response", (res) => {
    const type = res.request().resourceType();
    if (
      (type === "document" || type === "fetch") &&
      res.url().startsWith(origin)
    ) {
      // Faces are data URIs; their contents aren't the page's words
      bodies.push(
        res.text().then(
          (body) => body.replace(/data:[^"'\s)]+/g, ""),
          () => "",
        ),
      );
    }
  });
  page.on("websocket", (ws) => {
    // Pusher's, not the dev server's hot reload
    if (!/pusher\.com/.test(ws.url())) return;
    ws.on("framereceived", ({ payload }) => frames.push(String(payload)));
  });
  return {
    frames: () => frames,
    /** What arrived since the last drain. */
    async drain() {
      const taken = { bodies: await Promise.all(bodies), frames };
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
  const seen = watch(watcher, origin);
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

  const before = await seen.drain();
  const beforeText = [await watcher.locator("main").innerText()];
  expect(before.bodies.length).toBeGreaterThan(1); // the page and the refetch
  expect(leaks(COUNT_IN_DATA, before.bodies), "counts in page data").toEqual(
    [],
  );
  expect(leaks(COUNT_IN_TEXT, beforeText), "counts on screen").toEqual([]);
  expect(
    leaks(HIDDEN_NAMES.map(named), [...before.bodies, ...beforeText]),
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
  // The page can show the voted view a moment before Playwright has
  // recorded the response that carried it, so keep collecting until then
  const votedBodies: string[] = [];
  // The control: the same detectors now find counts, so they aren't blind
  await expect
    .poll(
      async () => {
        votedBodies.push(...(await seen.drain()).bodies);
        return leaks(COUNT_IN_DATA, votedBodies).length;
      },
      { message: "counts in data", timeout: 10_000 },
    )
    .toBeGreaterThan(0);
  const votedText = [await watcher.locator("main").innerText()];
  expect(
    leaks(COUNT_IN_TEXT, votedText).length,
    "counts on screen",
  ).toBeGreaterThan(0);
  expect(
    leaks(HIDDEN_NAMES.map(named), [...votedBodies, ...votedText]),
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
