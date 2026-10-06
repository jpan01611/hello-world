# Product design and assignment follow-through

## Designing for Sam

### Visual identity: funfunfunsahur

The UI combines a warm, handcrafted lodge feel with meme-culture energy:
walnut and cream surfaces, subtle CSS wood grain, ember-orange actions,
lime accents, and chunky readable headings. Photo cards resemble a community
corkboard rather than a sterile dashboard. Navigation retains link semantics
but looks like tactile buttons; voting uses generous targets and visible
selected states. Rhythmic loading and tap feedback respect reduced-motion
preferences. The direction uses abstract texture and percussion-inspired
motion rather than borrowing specific cultural symbols.

Sam is a Columbia College junior, chronically online, originally from the
Midwest, and still discovering New York City. Crackd turns ordinary photos
from dorm life and weekend city trips into a shared caption contest. Uploading
a file or pasting an image URL makes contributing straightforward; generating
another caption on their own existing photo lets Sam participate without needing a
new photo every time. The responsive gallery and quick up/down votes support
short visits between classes.

The return-visit hypothesis is fresh photos, new caption attempts, and changing
vote scores: Sam can come back to discover new jokes and see which captions
the community prefers. This depends on people contributing regularly; the app
does not currently provide daily challenges, notifications, or a social graph.
For content to spread, it needs recognizable situations and good jokes, not
just more generations. Campus and NYC photos are a plausible starting point,
but the current app does not enforce a city theme or provide sharing tools.

## What we would improve about Crackd.ai

A useful improvement to a caption-generation site is making it a participatory
contest rather than a one-off output: allow multiple caption attempts, let
people rate them, and make the best-rated result easy to find. Crackd already
supports multiple captions, displays a featured caption by net votes (newest
breaks ties), and collapses the remaining captions to keep browsing compact.
Saving the actual prompts and exposing them through "View prompt" also makes
the generation process inspectable instead of opaque.

A possible next experiment is an optional daily campus/NYC photo challenge.
It would give Sam a concrete reason to return and a shared context for jokes.
This is a proposal, not an implemented feature; PM feedback should establish
whether it is more useful than improving the existing posting and voting flow.
Avoid adding streaks or leaderboards merely to increase feature count.

## PM feedback and iteration

**Status: feedback has not been recorded.** The technical changes made so far
are not evidence of a Feedback Group session. After the PM tries the app,
record their actual observations and the resulting changes here.

| Session/date | PM observation | Decision and rationale | Change made | Follow-up result |
|--------------|----------------|------------------------|-------------|------------------|
| Pending | Not yet recorded | Pending feedback | None attributed to PM feedback | Not yet evaluated |

Ask the PM to post a photo, generate a caption, vote, undo or flip the vote,
and inspect a prompt. Note where they hesitate and whether the featured
caption and voting feedback are understandable. Prioritize observed friction
over speculative engagement features, then have them retry the changed flow.

## Deployment and submission checklist

These are completion steps, not claims that deployment has been verified.
The author performs commits and pushes; coding agents must not do either.

- [ ] Record PM feedback and implement the agreed changes.
- [ ] Manually commit and push the final revision.
- [ ] Confirm the Vercel deployment corresponds to that exact commit.
- [ ] Configure the deployment's environment variables and Supabase OAuth redirects.
- [ ] Disable Vercel deployment protection for the submitted deployment.
- [ ] Open the deployment in Incognito without a Vercel login; confirm that
      the app's own login page is accessible. Vercel protection and the app's
      Google sign-in are separate controls.
- [ ] Sign in and verify posting, caption generation, saved prompts, and voting
      against the deployed database; confirm votes persist after reload.
- [ ] Confirm signed-out users cannot generate captions or submit votes.
- [ ] Submit the commit-specific deployment URL, not just a moving production alias.

**Submission evidence:** commit SHA and deployment URL have not been recorded.
See [setup.md](./setup.md) for configuration instructions.
