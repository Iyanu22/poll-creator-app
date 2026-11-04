import { expect, type Browser, type Page } from "@playwright/test";
import samplePolls from "../data/sample-polls.json";

export const pizza = samplePolls.polls.find((p) =>
  p.title.startsWith("Pizza night"),
)!;

/** A fresh browser: its own cookies, so its own voter token. */
export async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

/**
 * A guest creator on their private copy of pizza night (open, 11 votes).
 * Writes only to that guest's sandbox, which is swept after 24 hours.
 */
export async function openGuestPizza(browser: Browser) {
  const creator = await newPage(browser);
  await creator.goto("/");
  await creator
    .getByRole("button", { name: "Try it with sample polls" })
    .click();
  await creator.waitForURL("**/polls");
  await creator.getByRole("link", { name: pizza.title }).first().click();
  await creator.waitForURL(/\/polls\/[a-z0-9]+$/);
  const votePath = new URL(creator.url()).pathname.replace("/polls/", "/p/");
  return { creator, votePath };
}

export async function castVote(page: Page, name: string) {
  // The ballot's, not the closed "Suggest something else" dialog's
  await page.getByLabel("Your name", { exact: true }).first().fill(name);
  await page
    .getByRole("group", { name: "Your pick" })
    .getByRole("radio")
    .first()
    .check({ force: true }); // the radio is visually hidden; its label shows
  await page.getByRole("button", { name: /^Cast my vote for/ }).click();
  await page
    .getByRole("dialog", { name: "Lock it in?" })
    .getByRole("button", { name: "Cast it" })
    .click();
  // A cast plus the refreshed page: seconds from far away or on a dev server
  await expect(page.getByText(`You're in, ${name}.`)).toBeVisible({
    timeout: 15_000,
  });
}

/** Opens the vote page in a fresh browser and votes. */
export async function voteAsSomeoneElse(
  browser: Browser,
  votePath: string,
  name: string,
) {
  const page = await newPage(browser);
  await page.goto(votePath);
  await castVote(page, name);
}
