# Tiebreak — Product Challenge

Settle group decisions: polls that live in the group chat, where voters need no account and the reveal feels like the end of a good game.

![Preview of Tiebreak](./preview.jpg)

*This is a design concept image of one screen (the live results view), not the intended design. There's no Figma file. You make the design decisions.*

## The Challenge

Tiebreak is a **Product Challenge** on [Frontend Mentor](https://www.frontendmentor.io). There's no Figma file. You make the design decisions, and you ship a real, deployed product with a database, authentication, and live-updating results. The result is a portfolio piece that shows employers your product thinking and your engineering in one place.

The problem: group chats are terrible at decisions. Twenty messages about pizza and no pizza. Polling tools exist, but they're either enterprise survey builders or joyless utilities. Tiebreak is social: share a link anyone can vote on without an account, let voters suggest options the creator didn't think of (approved or declined; your call, house rules), and end with a reveal worth screenshotting back into the chat. **A poll goes from created to decided inside one conversation.**

### Four Pillars

| Pillar | What It Means for Tiebreak |
|--------|----------------------------|
| **Product Thinking** | You design the voter's journey after they tap "Cast my vote", the reveal moment, and the first-run experience — genuine product decisions with no single right answer. You also decide real product rules: what reopening a poll means, where the one-vote line sits for account-less voters. |
| **Design Taste & Craft** | The brand kit gives you a complete visual direction — or a bar to clear with your own. Honest data viz at small vote counts is a design feature: per-voter tallies, counts beside every percentage, ties handled deliberately. |
| **AI Collaboration** | The project includes AI context files (`AGENTS.md`, `CLAUDE.md`) that give tools like Claude full project context. Lean into AI across planning, building, and polishing. |
| **Shipping Real Products** | Deploy to a live URL. Real database, real auth, public no-account pages, live-updating results, and a poll state machine (open → settled → reopened) enforced server-side, not just in the UI. |

## What You're Building

A creator makes a poll and pastes the link into the group chat. Voters tap through on their phones, type a name, pick an avatar, and vote — no accounts. They can suggest options; the creator moderates. Results update live and stay honest at small numbers. When voting ends, the winner gets a proper reveal.

- **Creator accounts & dashboard** — auth for creators only; open and settled polls at a glance, with the poll that needs attention featured
- **Poll creation** — freeform title, 2–10 options, a closing time, single vote or pick-up-to-N, done in under a minute
- **The vote page** — public, no-account, phone-first: name + avatar, an unmistakable selected state, and a vote that's final ("no takebacks")
- **Suggestions & moderation** — voters propose options; the creator approves ("Add it" — joins with 0 votes) or declines ("Not this time", with undo)
- **Live results** — a segmented per-voter tally for the leader, pack bars relative to the leader, counts beside every percentage, updates as votes land
- **Closing & the reveal** — auto-close or end early, attribution revealed at close, a designed winner moment, and reopening (with a confirm)
- **Landing page & guest mode** — a compelling front door and a one-click "Try as guest" pre-loaded with believable polls

### The Guest Experience

When you share this project — in your portfolio, a job application, or a social post — the person clicking your link isn't going to create an account. Guest mode is what lets them see your work instead of a login wall.

Your landing page includes a "Try as guest" button. Guests enter a demo dashboard pre-loaded from `data/sample-polls.json`: five polls covering a close live race with a pending suggestion, a one-vote lead with a tie behind it, two settled polls, and a fresh zero-vote poll. A dashboard mid-game makes the value obvious in seconds.

## Project Structure

```
tiebreak/
├── spec/
│   ├── product-definition.md      # What, who, why
│   ├── core-requirements.md       # 14 features: 10 core + 4 stretch
│   ├── design-challenges.md       # 3 experiences YOU design
│   ├── technical-requirements.md  # State machine, database, auth, avatars + frontend-only path
│   └── differentiators.md         # 4 enhancements (pick 1-2)
├── guidance/
│   ├── brand-kit.md               # The brand direction: palette roles, type, data-viz rules
│   ├── patterns.md                # UI/UX do's and don'ts
│   └── accessibility.md           # WCAG 2.2 AA checklist
├── starter/
│   ├── tokens.css                 # CSS custom properties (the brand-kit tokens)
│   └── tailwind.css               # Optional Tailwind v4 config
├── data/
│   ├── sample-polls.json          # 5 polls, 32 votes (the guest dataset, matching preview.jpg)
│   └── README.md                  # Data shape and the edge case each poll exercises
├── AGENTS.md                      # AI collaboration context
├── CLAUDE.md                      # Points to AGENTS.md
└── README-template.md             # Template for your solution README
```

## Getting Started

1. **Read the spec** — Start with `spec/product-definition.md`, then `core-requirements.md`. Understand the two audiences before you write code: the organizer with an account, and the voter who will never make one.

2. **Review the brand kit** — `guidance/brand-kit.md` gives you the visual direction: cream tabletop, cocoa ink, tangerine/teal/butter with strict jobs, Gabarito over Karla. Use it as your starting point. Or, if you have a clear design vision of your own, create your own brand kit and hold it to the same bar. The starter tokens and optional Tailwind config are ready to use.

3. **Explore the patterns** — `guidance/patterns.md` covers honest live results, the guest vote flow, suggestion moderation, and the traps (results spin, voter friction, celebration creep). Use it to make strong decisions without a Figma file.

4. **Choose your stack** — Framework-agnostic. Next.js, Nuxt, SvelteKit, Remix, a Rails or Laravel monolith: whatever you're most productive with. The recommended path is full-stack (database + auth); there's a **frontend-only alternative** (pass-the-phone mode) if you can't take on a backend. See `spec/technical-requirements.md`.

5. **Set up your AI workflow** — `AGENTS.md` and `CLAUDE.md` give AI tools full context about the project: specs, guidance, and collaboration approach. We recommend working with AI across every phase: planning, building, and polishing.

6. **Pick your differentiators** — Read `spec/differentiators.md` and choose 1-2 that match your interests: truly live results, a generated share card, sudden-death tiebreakers, or poll quick-starts. These are what make the project _yours_.

7. **Start building** — Foundation first (auth, schema, a poll you can create and vote on), then the live results view, suggestions and moderation, and the close/reveal flow. The core-requirements spec is your roadmap; core features give you a solid product, stretch features take it further.

8. **Document as you go** — Use `README-template.md` for your solution README. Record design decisions, technical trade-offs, and lessons learned as they happen, not after. Give the three design challenges the fullest write-ups.

## Working with AI

Product Challenges are designed for AI collaboration. The `AGENTS.md` and `CLAUDE.md` files give AI tools like Claude, Cursor, and Copilot full project context, including the spec, brand kit, and collaboration guidelines. Load them at the start of each session.

Lean on AI for implementation, but don't just accept what it gives you. The design decisions are yours, and so is the code quality: review what gets generated, understand it, and make sure it's something you'd be happy putting your name on. The three design-it-yourself experiences (**the voter's side of the story**, **the reveal**, and **first run**) are where your product thinking matters most. Think those through yourself before you let AI fill in the code.

## Your Solution Repo

The `.gitignore` is pre-configured to exclude challenge reference files (`spec/`, `guidance/`, `AGENTS.md`, etc.) from your solution repo. These files are your development reference: they stay on your machine for AI sessions and planning, but they don't belong in the finished product.

Your public repo should contain:

- Your application code
- Your completed README (rename `README-template.md` → `README.md`)
- The sample data file (`data/sample-polls.json`, needed for the guest experience)
- The starter tokens (consumed by your build)

This is how real products work: you reference the spec during development, you ship the product.

## Learning Outcomes

By completing this challenge, you'll have demonstrated:

- Designing and enforcing a real state machine on the server, not just in the UI: polls that open, settle, and reopen; suggestions that move through pending/approved/declined; votes that are final
- Building public, no-auth pages with per-voter identity and casual duplicate-vote prevention, alongside authenticated creator flows
- Presenting live, small-n data honestly: per-voter tallies, relative bars, counts beside every percentage, and deliberate tie states
- Live-updating UI that respects assistive technology: throttled live regions, stable focus, no layout jitter
- Designing unspecified product moments (post-vote, the reveal, first run) from a brief rather than a mockup, and defending those decisions in writing
- Deploying a performant, accessible, responsive product to a live URL and reasoning about the trade-offs you made

## Key Design Moments

These screens are where your design taste will be most visible:

1. **The reveal / settled poll** — the hero moment. Voting ends, one option wins, and the screen should feel like the end of a good game. It's the screen people screenshot back into the chat, and it's yours to design, tie state included.
2. **The public vote page** — the most-visited screen, seen by people who never chose to use Tiebreak. Choosing a face should be fun, voting should be one obvious action, and the whole thing has to feel polished and self-contained on a phone.
3. **The live results view** — where the data-viz rules pay off. The leader, the tally, the pack, and the pending suggestion need clear hierarchy: one glance answers "who's winning, and is it close?" (`preview.jpg` shows one take; yours can differ.)

## Deploying Your Project

Product Challenges require a live, publicly accessible URL. Recommended hosts:

- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)
- [Render](https://render.com/)
- [Fly.io](https://fly.io/)

Make sure your environment variables are configured correctly and no secrets are exposed. Test your deployed URL in an incognito window before submitting, especially the guest experience and the vote page from a real phone (create a poll, text yourself the link, vote from the sofa).

For more guidance, see our [hosting guide](https://www.frontendmentor.io/guides/hosting-your-solution).

## Submitting Your Solution

Submit your solution on the platform for the rest of the community to see. Follow our [guide to submitting solutions](https://www.frontendmentor.io/guides/how-to-submit-solutions) for the full process.

When submitting, you'll need:

- **Live site URL** — Submit the URL to your guest experience (e.g., `your-app.vercel.app/guest`), not the landing page. This ensures our solution reporters analyze your product code rather than the homepage. Test in incognito first.
- **Repository URL** — A public repo with your solution code and completed README

For your retrospective, Product Challenges give you a lot to write about: the reveal design, honest data viz, the no-account voter flow, AI collaboration, technical trade-offs. Be specific about what you're proud of and where you'd like feedback. See our [guide to writing effective retrospectives](https://www.frontendmentor.io/guides/write-an-effective-retrospective) for tips.

## Sharing Your Solution

Product Challenges create portfolio pieces worth sharing beyond the platform:

1. Share your solution page in the **#finished-projects** channel of our [community](https://www.frontendmentor.io/community).
2. Post on LinkedIn or X with both your live URL and repo link. The guest experience means anyone clicking your link sees the product immediately. Better yet, run a real poll with your friends first and share the result.
3. Add it to your portfolio (see our [guide to using challenges in your portfolio](https://www.frontendmentor.io/guides/use-challenges-in-your-portfolio)).
4. Blog about your experience. The state-machine design, the honest-data-viz rules, and the AI collaboration journey make for compelling content. Great platforms to write on are [dev.to](https://dev.to/), [Hashnode](https://hashnode.com/), and [CodeNewbie](https://community.codenewbie.org/).

## Questions?

If anything in the spec is unclear or you want to discuss the challenge, join our [Discord community](https://www.frontendmentor.io/community).

## Got Feedback for Us?

We love receiving feedback! If you have anything you'd like to mention, please email hi[at]frontendmentor[dot]io.
