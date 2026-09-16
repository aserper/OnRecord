# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the owner of a private, self-hosted OnRecord instance. They are a frequent user who wants to investigate their own listening history in depth. Existing multi-account and collaborative behavior must remain available for other invited users.

## Product Purpose

OnRecord continuously records Spotify listening activity and turns it into an explorable personal archive. It should make it easy to move from high-level patterns into the artists, albums, tracks, sessions, and moments that produced them. Success means deep exploration feels fluid while operational states remain trustworthy and understandable.

## Positioning

Unlike a periodic summary, OnRecord is a self-hosted, continuously growing listening-history database whose date ranges, rankings, detail views, and imports let its owner investigate their complete archive on demand.

## Operating Context

The application runs in a private Kubernetes cluster and is reached through `https://onrecord.amit.wtf`. The owner primarily uses it to explore listening patterns and historical data. Full privacy-history imports can be very large and may run for an extended period while interacting with Spotify API rate limits.

## Capabilities and Constraints

- Preserve all existing routes and user-facing behavior, including overview statistics, history, top artists/albums/tracks, detail views, longest sessions, benchmarks, collaborative affinity, account settings, imports, registration controls, and light/dark mode.
- Deep exploration is the leading workflow; movement between aggregate statistics and underlying artists, albums, tracks, and time periods should be especially strong.
- Users can track external Spotify playlists by URL and review a recorded history of what was added to or removed from each playlist over time.
- Spotify OAuth, playback/link affordances, configurable date ranges, multiple accounts, and responsive behavior must continue to work.
- The maintained fork must incorporate the live rate-limit/OAuth and metadata-request hotfixes in source code rather than relying on bundle string replacement.
- Deployment must retain persistent MongoDB data and uploaded import files, use a Recreate strategy, and support a safe migration from the current LinuxServer image.
- Do not assume a failed full-history import checkpoint proves every earlier row was committed; recovery must be conservative.

## Brand Commitments

The product is named OnRecord. Keep the factual relationship to Spotify and to the upstream Your Spotify project; do not imply that the fork is an official Spotify product. Existing recognizable data and album/artist imagery remain product content, not invented promotional material.

## Evidence on Hand

- Upstream source and documentation in this repository.
- A live Kubernetes deployment and ConfigMap containing the currently deployed hotfix implementation.
- Real listening-history data in the live instance for eventual browser verification.
- No testimonials, commercial claims, or public-user research are available and none should be fabricated.

## Product Principles

1. Exploration should continuously reveal the evidence behind a statistic.
2. Dense personal data should remain scannable without becoming simplistic.
3. Long-running imports, cooldowns, and failures must communicate state and recovery paths honestly.
4. Existing capabilities are preserved even when their structure and presentation are substantially redesigned.
5. Self-hosting should remain maintainable: fixes belong in source, deploys are reproducible, and user data survives replacement.

## Accessibility & Inclusion

The redesigned web interface must support keyboard navigation, visible focus, reduced motion, sufficient color contrast, semantic structure, and responsive use without removing analytical detail.
