import { randomInt } from "node:crypto";

import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import {
  decodeClientMessage,
  type PreviewArticleRequest,
  type ServerMessage,
} from "@wikiduel/contracts";

import { createDuelCore } from "./duel-core/duelCore.js";
import type { PlayableArticleRepository } from "./playable-articles/repository.js";
import {
  buildPreviewDiagnostics,
  previewArticleResult,
  previewError,
} from "./playable-articles/preview.js";
import type { PromptCatalog } from "./prompt-catalog/catalog.js";
import { deterministicPromptCatalog } from "./prompt-catalog/fixtures.js";

export type BuildAppOptions = Readonly<{
  repository?: PlayableArticleRepository;
  production?: boolean;
  promptCatalog?: PromptCatalog;
  promptRandom?: () => number;
  createDuelId?: () => string;
}>;


type LobbyMember = {
  id: string;
  name: string;
  role: "host" | "opponent";
  connected: boolean;
  ready: boolean;
};

type MemberRecord = LobbyMember & {
  socket?: WebSocket;
};

type LobbyRecord = {
  code: string;
  matched: boolean;
  members: Map<string, MemberRecord>;
};

type SocketSession = {
  memberId?: string;
  lobbyCode?: string;
};

const LOBBY_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function serializeMessage(message: object): string {
  return JSON.stringify({
    ...message,
    sentAt: new Date().toISOString(),
  });
}

type CommandRejectionMessage = Extract<ServerMessage, { type: "command-rejected" }>;

function sendCommandRejection(
  socket: WebSocket,
  command: CommandRejectionMessage["command"],
  reason: CommandRejectionMessage["reason"],
): void {
  socket.send(serializeMessage({ type: "command-rejected", command, reason }));
}

function generateLobbyCode(lobbies: Map<string, LobbyRecord>): string {
  let code = "";

  do {
    code = Array.from(
      { length: 5 },
      () => LOBBY_CODE_CHARACTERS[randomInt(LOBBY_CODE_CHARACTERS.length)],
    ).join("");
  } while (lobbies.has(code));

  return code;
}

function lobbyState(lobby: LobbyRecord): string {
  return serializeMessage({
    type: "lobby-state",
    lobby: {
      code: lobby.code,
      members: Array.from(lobby.members.values(), ({ socket: _socket, ...member }) => member),
    },
  });
}

function broadcastLobby(lobby: LobbyRecord): void {
  const message = lobbyState(lobby);

  for (const member of lobby.members.values()) {
    if (member.connected && member.socket?.readyState === 1) {
      member.socket.send(message);
    }
  }
}

function previewRequestHints(value: unknown): Partial<PreviewArticleRequest> {
  if (typeof value !== "object" || value === null) return {};
  const message = value as Record<string, unknown>;
  return {
    ...(typeof message.requestId === "string" ? { requestId: message.requestId } : {}),
    ...(typeof message.requestedTitle === "string" ? { requestedTitle: message.requestedTitle } : {}),
  };
}

function isPreviewMessage(value: unknown): boolean {
  return typeof value === "object"
    && value !== null
    && (value as Record<string, unknown>).type === "preview-article";
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const lobbies = new Map<string, LobbyRecord>();
  const promptCatalog = options.promptCatalog
    ?? (options.production ? undefined : deterministicPromptCatalog);
  const duelCore = promptCatalog
    ? createDuelCore({
        promptCatalog,
        random: options.promptRandom,
        createDuelId: options.createDuelId,
      })
    : null;

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' https://upload.wikimedia.org",
    ].join("; "));
    return payload;
  });

  await app.register(websocket);

  app.get("/", async () => ({ name: "wikiduel-server", status: "ok" }));
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ws", { websocket: true }, (socket) => {
    const session: SocketSession = {};

    socket.send(serializeMessage({ type: "welcome", message: "Connected to WikiDuel server" }));

    const leaveCurrentLobby = (disconnected = false) => {
      if (!session.lobbyCode || !session.memberId) return;

      const lobby = lobbies.get(session.lobbyCode);
      const member = lobby?.members.get(session.memberId);

      if (lobby && member?.socket === socket) {
        if (lobby.matched) {
          lobbies.delete(lobby.code);
          const forfeit = disconnected
            ? duelCore?.disconnectPlayer({ lobbyId: lobby.code, playerId: member.id })
            : null;
          if (!forfeit) duelCore?.disbandLobby(lobby.code);

          for (const remainingMember of lobby.members.values()) {
            if (
              remainingMember.id !== member.id
              && remainingMember.connected
              && remainingMember.socket?.readyState === 1
            ) {
              remainingMember.socket.send(serializeMessage(forfeit
                ? {
                    type: "duel-forfeited",
                    ...forfeit,
                    message: "Your opponent disconnected. The Duel ended by Forfeit.",
                  }
                : {
                    type: "lobby-closed",
                    message: "The other player left. The lobby has been closed.",
                  }));
            }
          }
        } else {
          lobby.members.delete(member.id);
          if (lobby.members.size === 0) lobbies.delete(lobby.code);
        }
      }

      session.lobbyCode = undefined;
      session.memberId = undefined;
    };

    const joinLobby = (lobby: LobbyRecord, clientId: string, role: "host" | "opponent") => {
      leaveCurrentLobby();

      const existingMember = lobby.members.get(clientId);
      const member: MemberRecord = existingMember ?? {
        id: clientId,
        name: role === "host" ? "host" : "Opponent",
        role,
        connected: true,
        ready: false,
      };

      member.connected = true;
      member.socket = socket;
      lobby.members.set(member.id, member);
      session.lobbyCode = lobby.code;
      session.memberId = member.id;
      if (lobby.members.size === 2) lobby.matched = true;
      broadcastLobby(lobby);
    };

    socket.on("message", async (data) => {
      try {
        const parsedMessage: unknown = JSON.parse(data.toString());
        const decodedMessage = decodeClientMessage(parsedMessage);

        if (!decodedMessage.ok) {
          if (isPreviewMessage(parsedMessage)) {
            socket.send(serializeMessage(
              previewError(previewRequestHints(parsedMessage), "malformed-message"),
            ));
          } else {
            socket.send(serializeMessage({ type: "lobby-error", message: "Invalid message" }));
          }
          return;
        }

        const message = decodedMessage.message;
        if (message.type === "preview-article") {
          if (options.production || !options.repository) {
            socket.send(serializeMessage(previewError(message, "preview-unavailable")));
            return;
          }

          const startedAt = performance.now();
          let lookup;
          try {
            lookup = options.repository.getByTitleWithDiagnostics
              ? await options.repository.getByTitleWithDiagnostics(message.requestedTitle)
              : {
                result: await options.repository.getByTitle(message.requestedTitle),
                cacheOutcome: "miss" as const,
                details: {},
              };
          } catch {
            lookup = {
              result: { ok: false as const, failure: { code: "upstream-unavailable" as const } },
              cacheOutcome: "not-cached" as const,
              details: {},
            };
          }
          const diagnostics = buildPreviewDiagnostics(
            message.requestedTitle,
            lookup.result,
            performance.now() - startedAt,
            lookup.cacheOutcome,
            lookup.details,
          );
          socket.send(serializeMessage(previewArticleResult(message, lookup.result, diagnostics)));
          return;
        }

        if (message.type === "ping") {
          socket.send(serializeMessage({ type: "pong", message: "Pong from WikiDuel server" }));
          return;
        }

        if (message.type === "create-lobby") {
          if (session.lobbyCode && duelCore?.hasActiveDuel(session.lobbyCode)) {
            sendCommandRejection(socket, "create-lobby", "invalid-state");
            return;
          }
          const code = generateLobbyCode(lobbies);
          const lobby: LobbyRecord = { code, matched: false, members: new Map() };
          lobbies.set(code, lobby);
          joinLobby(lobby, message.clientId, "host");
          return;
        }

        if (message.type === "join-lobby") {
          if (session.lobbyCode && duelCore?.hasActiveDuel(session.lobbyCode)) {
            sendCommandRejection(socket, "join-lobby", "invalid-state");
            return;
          }
          const code = message.lobbyCode.trim().toUpperCase();
          const lobby = lobbies.get(code);

          if (!lobby) {
            socket.send(serializeMessage({ type: "lobby-error", message: "Lobby not found" }));
            return;
          }

          if (!lobby.members.has(message.clientId) && lobby.members.size >= 2) {
            socket.send(serializeMessage({ type: "lobby-error", message: "Lobby is full" }));
            return;
          }

          joinLobby(lobby, message.clientId, "opponent");
          return;
        }

        if (message.type === "set-ready") {
          if (!session.lobbyCode || !session.memberId) return;

          if (duelCore?.hasActiveDuel(session.lobbyCode)) {
            sendCommandRejection(socket, "set-ready", "invalid-state");
            return;
          }

          const lobby = lobbies.get(session.lobbyCode);
          const member = lobby?.members.get(session.memberId);
          if (!lobby || !member) return;

          member.ready = message.ready;
          broadcastLobby(lobby);
          return;
        }

        if (message.type === "start-duel") {
          if (!session.lobbyCode || !session.memberId) {
            sendCommandRejection(socket, "start-duel", "invalid-state");
            return;
          }

          const lobby = lobbies.get(session.lobbyCode);
          if (!lobby) {
            sendCommandRejection(socket, "start-duel", "invalid-state");
            return;
          }

          if (!duelCore) {
            sendCommandRejection(socket, "start-duel", "invalid-state");
            return;
          }

          const result = duelCore.startDuel({
            lobbyId: lobby.code,
            actorId: session.memberId,
            players: Array.from(lobby.members.values(), ({ socket: _socket, ...player }) => player),
          });
          if (!result.ok) {
            sendCommandRejection(
              socket,
              result.rejection.command,
              result.rejection.reason,
            );
            return;
          }

          for (const projection of result.projections) {
            const recipient = lobby.members.get(projection.recipientId);
            if (recipient?.socket?.readyState === 1) {
              recipient.socket.send(serializeMessage({
                type: "duel-state",
                duel: projection.duel,
              }));
            }
          }
          return;
        }

        if (message.type === "leave-lobby") {
          if (session.lobbyCode && duelCore?.hasActiveDuel(session.lobbyCode)) {
            sendCommandRejection(socket, "leave-lobby", "invalid-state");
            return;
          }
          leaveCurrentLobby();
        }
      } catch {
        socket.send(serializeMessage({ type: "lobby-error", message: "Invalid message" }));
      }
    });

    socket.on("close", () => leaveCurrentLobby(true));
  });

  return app;
}
