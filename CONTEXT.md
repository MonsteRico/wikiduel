# Wiki Duel

Wiki Duel is a competitive Wikipedia racing game in which two players navigate the same article challenge and compare route-finding skill across a duel.

## Language

**Duel**:
A complete contest between two players, composed of rounds and normally ending when one player's HP reaches zero. It may instead end by Forfeit.
_Avoid_: Game, session

**Player Session**:
An anonymous player's server-issued identity within a lobby, reclaimable from the same browser using an unguessable token. A socket connection is temporary transport state and does not identify the player.
_Avoid_: User, account, socket

**Lobby**:
A private pairing of exactly two Player Sessions once joined, holding shared settings, successive rematch duels, and its own used-prompt history. It never admits a replacement player and disbands when either player explicitly leaves or exhausts a reconnect window; a new lobby starts with every enabled prompt available again.
_Avoid_: Room, party

**Host**:
The Player Session that created the lobby and may change its settings while no duel is active. Host ownership never transfers.
_Avoid_: Owner, admin

**Forfeit**:
A duel outcome caused by explicit departure or an exhausted reconnect window rather than HP loss. Current HP is preserved and the remaining player is the winner.
_Avoid_: Abandonment, technical loss

**Round**:
One race in a duel where both players navigate from the same start article toward the same target article. A target arrival ends it immediately; an enabled time limit can instead end it as a no-damage draw.
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

**Time Limit**:
An optional lobby rule that caps round duration. Reaching it produces a draw with no damage rather than selecting a winner by partial progress.
_Avoid_: Soft cap, round timer

**Damage Rule**:
A globally deployed policy that converts round results and relevant round context into HP loss for the losing player. All duels use the rule shipped in the running code until a future release replaces it.
_Avoid_: Damage formula, scoring formula
