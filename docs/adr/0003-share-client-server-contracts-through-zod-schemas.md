# Share client-server contracts through Zod schemas

Wiki Duel defines serialized Playable Article and realtime message contracts in a neutral workspace package whose private strict Zod 4 schemas are the source of truth. The client and server consume inferred types and stable direction-specific decode functions without importing each other's source, receiving Zod errors, or sharing authoritative transition logic. This replaces duplicated types and unchecked casts while keeping message shape validation separate from state and authorization rules in the server core.
