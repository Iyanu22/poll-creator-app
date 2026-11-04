import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { POLL_CHANGED } from "../src/lib/realtime";
import { openGuestPizza, voteAsSomeoneElse } from "./helpers";

// Live updates when the connection hiccups. Pusher doesn't replay events a
// page missed, so the page has to catch up by itself. Each test holds back
// Pusher's messages to the creator's page while someone votes, as a dead
// network or a sleeping phone does, then checks the creator's count catches
// up once the page is listening again. Needs Pusher configured.

/** Proxies the page's Pusher socket so its messages can be held back. */
async function interceptPusher(page: Page) {
  const pusher = {
    holding: false,
    /** Poll-changed events that never reached the page. */
    dropped: 0,
    socket: undefined as WebSocketRoute | undefined,
  };
  await page.routeWebSocket(/pusher\.com/, (socket) => {
    const server = socket.connectToServer();
    pusher.socket = socket;
    socket.onMessage((message) => server.send(message));
    server.onMessage((message) => {
      if (!pusher.holding) return socket.send(message);
      if (JSON.parse(String(message)).event === POLL_CHANGED) pusher.dropped++;
    });
  });
  // Reload so the socket opens through the proxy
  await page.reload();
  await expect(page.getByText("Live: updates as votes land")).toBeVisible({
    timeout: 20_000,
  });
  return pusher;
}

/** The creator page's "11 of your crew voted". */
async function votersOn(page: Page) {
  const text = await page.getByText(/\d+ of your crew/).innerText();
  return Number(text.match(/\d+/)![0]);
}

/** What the browser reports when a phone backgrounds the tab, and back. */
async function setVisibility(page: Page, state: "hidden" | "visible") {
  await page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

/** Someone votes, and the event about it is lost on the way. */
async function voteWhileHolding(
  pusher: Awaited<ReturnType<typeof interceptPusher>>,
  page: Page,
  vote: () => Promise<void>,
) {
  const before = await votersOn(page);
  pusher.holding = true;
  await vote();
  // The vote's event goes server → Pusher → page: allow for a slow server
  await expect.poll(() => pusher.dropped, { timeout: 20_000 }).toBe(1);
  expect(await votersOn(page), "the lost event changed nothing").toBe(before);
  pusher.holding = false;
  return before;
}

test("a page catches up after a network blip", async ({ browser }) => {
  const { creator, votePath } = await openGuestPizza(browser);
  const pusher = await interceptPusher(creator);

  const before = await voteWhileHolding(pusher, creator, () =>
    voteAsSomeoneElse(browser, votePath, "Catch-up Blip"),
  );
  // The socket drops and reconnects straight away, never "unavailable"
  await pusher.socket!.close();

  await expect
    .poll(() => votersOn(creator), { timeout: 8_000 })
    .toBe(before + 1);
});

test("a page catches up when it's shown again", async ({ browser }) => {
  const { creator, votePath } = await openGuestPizza(browser);
  const pusher = await interceptPusher(creator);

  // A backgrounded tab: the socket still looks connected, nothing arrives
  await setVisibility(creator, "hidden");
  const before = await voteWhileHolding(pusher, creator, () =>
    voteAsSomeoneElse(browser, votePath, "Catch-up Return"),
  );
  // Back from the group chat
  await setVisibility(creator, "visible");

  await expect
    .poll(() => votersOn(creator), { timeout: 8_000 })
    .toBe(before + 1);
});
