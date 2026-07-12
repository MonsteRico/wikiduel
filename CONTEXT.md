# Wiki Duel

Wiki Duel is a competitive Wikipedia racing game in which two players navigate the same article challenge and compare route-finding skill across a duel.

## Language

**Duel**:
A complete contest between two players, composed of rounds and normally ending when one player's HP reaches zero. It may instead end by Forfeit.
_Avoid_: Game, session

**Player Session**:
An anonymous player's identity occupying one seat in a Lobby. It is distinct from the temporary connection carrying that player's commands.
_Avoid_: User, account, socket

**Lobby**:
A private pairing of exactly two Player Sessions once joined, holding successive rematch Duels and its own used-prompt history. It never admits a replacement player; a new Lobby starts with every enabled prompt available again.
_Avoid_: Room, party

**Host**:
The Player Session that created the Lobby and starts a Duel after both players are ready. Host ownership never transfers.
_Avoid_: Owner, admin

**Forfeit**:
Termination of a Duel caused by explicit departure, connection loss, or an exhausted optional reconnect window rather than HP loss. It disbands the Lobby without entering the normal post-Duel result flow.
_Avoid_: Abandonment, technical loss, victory

**Round**:
One race in a Duel where both players navigate from the same start article toward the same target article. A Target Arrival ends it immediately; the Time Limit can instead end it as a no-damage draw.
_Avoid_: Race, level

**Target Arrival**:
A player's valid navigation to the round's target article.
_Avoid_: Finish, completion

**Navigation**:
A server-validated move through an allowed internal link on the player's current article. Each navigation counts as one click; redirects resolve within that click to the canonical article, while displayed paths and browser history are not navigation controls.
_Avoid_: Page load, backtracking

**Playable Article**:
An existing canonical Wikipedia article in the main namespace that may appear in a player's route. Disambiguation pages are never playable; list, calendar-year, and calendar-date articles are excluded from the MVP playable graph.
_Avoid_: Wiki page, destination page

**Article Document**:
The typed, allowlisted content tree of a Playable Article that may cross from the server to a client. It contains only the structural, inline, Navigation, and media elements Wiki Duel explicitly supports.
_Avoid_: Sanitized HTML, article HTML, document AST

**Infobox**:
A compact Playable Article summary that groups identifying media and concise facts separately from the article body while retaining eligible Navigation Nodes.
_Avoid_: Generic table, sidebar table

**Navigation Node**:
An interactive Article Document element whose destination has been resolved and accepted as a canonical Playable Article. Activating it requests a Navigation to that destination.
_Avoid_: True link, playable anchor, clickable link

**Playable Article Lab**:
A development-only surface for requesting, rendering, navigating, and manually inspecting live Playable Articles through the same server boundary intended for Duels. It is the end-to-end acceptance surface for the playable-article pipeline and is unavailable in production.
_Avoid_: Test page, article browser, debug page

**Time Limit**:
The fixed five-minute cap on every MVP Round. Reaching it produces a draw with no damage rather than selecting a winner by partial progress.
_Avoid_: Soft cap, Lobby timer, configurable timer

**Damage Rule**:
A globally deployed policy that converts round results and relevant round context into HP loss for the losing player. All duels use the rule shipped in the running code until a future release replaces it.
_Avoid_: Damage formula, scoring formula
