import { randomInt } from "node:crypto";
import { access } from "node:fs/promises";
import { join } from "node:path";

import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import {
  decodeClientMessage,
  type PreviewArticleRequest,
  type ServerMessage,
} from "@wikiduel/contracts";

import { createDuelCore, type CreateDuelCoreOptions } from "./duel-core/duelCore.js";
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
  clientRoot?: string;
  promptCatalog?: PromptCatalog;
  promptRandom?: () => number;
  createDuelId?: () => string;
  now?: CreateDuelCoreOptions["now"];
  schedule?: CreateDuelCoreOptions["schedule"];
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
  timeLimitEnabled: boolean;
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
      timeLimitEnabled: lobby.timeLimitEnabled,
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
        repository: options.repository,
        now: options.now,
        schedule: options.schedule,
        onEvent: (lobbyId, event) => {
          const lobby = lobbies.get(lobbyId);
          if (!lobby) return;
          if (event.type === "projections") {
            for (const projection of event.projections) {
              const socket = lobby.members.get(projection.recipientId)?.socket;
              if (socket?.readyState === 1) socket.send(serializeMessage({
                type: "duel-state", duel: projection.duel,
              }));
            }
          } else {
            lobbies.delete(lobbyId);
            for (const member of lobby.members.values()) {
              if (member.socket?.readyState === 1) member.socket.send(serializeMessage({
                type: "duel-interrupted", duelId: event.duelId, reason: event.reason,
                message: event.reason === "preparation-deadline"
                  ? "A player could not prepare the Round within 30 seconds. The Duel was interrupted and the Lobby closed. No winner was assigned."
                  : "The start article could not be prepared. The Duel was interrupted and the Lobby closed. No winner was assigned.",
              }));
            }
          }
        },
      })
    : null;
  app.addHook("onClose", async () => duelCore?.dispose());

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "connect-src 'self' ws: wss:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https://upload.wikimedia.org https://thumb.wikimedia.org",
    ].join("; "));
    return payload;
  });

  await app.register(websocket);

  if (options.clientRoot) {
    await access(join(options.clientRoot, "index.html"));
    await app.register(fastifyStatic, { root: options.clientRoot, wildcard: false, index: false });
    for (const route of ["/", "/lobby/:lobbyCode", "/duel/:duelId"]) {
      app.get(route, async (_request, reply) => reply.sendFile("index.html", { maxAge: 0 }));
    }
  } else {
    app.get("/", async () => ({ name: "wikiduel-server", status: "ok" }));
  }
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    if (!options.repository || !promptCatalog) {
      return reply.code(503).send({ status: "not-ready" });
    }
    return { status: "ready" };
  });

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

        if (message.type === "leave-duel") {
          const lobby = session.lobbyCode ? lobbies.get(session.lobbyCode) : undefined;
          const member = session.memberId ? lobby?.members.get(session.memberId) : undefined;
          const departure = member?.socket === socket && duelCore?.leaveDuel({
            duelId: message.duelId, lobbyId: lobby!.code, playerId: member.id,
          });
          if (!departure) sendCommandRejection(socket, message.type, "invalid-state");
          else {
            lobbies.delete(lobby!.code);
            for (const player of lobby!.members.values()) {
              if (player.socket?.readyState === 1) player.socket.send(serializeMessage({
                ...departure,
                message: departure.type === "lobby-closed" ? "The completed Duel's Lobby has closed."
                  : player.id === member!.id ? "You left the Duel. The Lobby has closed."
                  : "Your opponent left. The Duel ended by Forfeit and the Lobby has closed.",
              }));
            }
            session.lobbyCode = undefined;
            session.memberId = undefined;
          }
          return;
        }

        if (message.type === "request-rematch" || message.type === "back-to-lobby") {
          const lobby = session.lobbyCode ? lobbies.get(session.lobbyCode) : undefined;
          const member = session.memberId ? lobby?.members.get(session.memberId) : undefined;
          const command = member && lobby ? { ...message, lobbyId: lobby.code, playerId: member.id } : undefined;
          const accepted = member?.socket === socket && command && (message.type === "request-rematch"
            ? duelCore?.requestRematch(command) : duelCore?.backToLobby(command));
          if (!accepted) sendCommandRejection(socket, message.type, "invalid-state");
          else if (message.type === "back-to-lobby") {
            for (const player of lobby!.members.values()) player.ready = false;
            broadcastLobby(lobby!);
          } else await duelCore!.prepareRound(lobby!.code);
          return;
        }

        if (message.type === "ready-next-round" || message.type === "continue-post-duel") {
          const lobby = session.lobbyCode ? lobbies.get(session.lobbyCode) : undefined;
          const member = session.memberId ? lobby?.members.get(session.memberId) : undefined;
          const command = member && lobby ? { ...message, lobbyId: lobby.code, playerId: member.id } : undefined;
          const accepted = member?.socket === socket && command && (message.type === "continue-post-duel"
            ? duelCore?.continueToPostDuel(command) : duelCore?.readyForNextRound(command));
          if (!accepted) sendCommandRejection(socket, message.type, "invalid-state");
          else if (message.type === "ready-next-round") await duelCore!.prepareRound(lobby!.code);
          return;
        }

        if (message.type === "round-received" || message.type === "round-rendered"
          || message.type === "navigate") {
          const lobby = session.lobbyCode ? lobbies.get(session.lobbyCode) : undefined;
          const member = session.memberId ? lobby?.members.get(session.memberId) : undefined;
          if (message.type === "navigate") {
            const accepted = !!(member?.socket === socket && duelCore
              && await duelCore.navigate({ ...message, lobbyId: lobby!.code, playerId: member.id }));
            socket.send(serializeMessage({ type: "navigation-result", duelId: message.duelId,
              roundId: message.roundId, requestId: message.requestId, accepted }));
            return;
          }
          const accepted = member?.socket === socket && duelCore
            && duelCore.acknowledgeRound({
              lobbyId: lobby!.code, playerId: member.id,
              duelId: message.duelId, roundId: message.roundId,
              kind: message.type === "round-received" ? "received" : "rendered",
            });
          if (!accepted) sendCommandRejection(socket, message.type, "invalid-state");
          return;
        }

        if (message.type === "create-lobby") {
          if (session.lobbyCode && duelCore?.hasActiveDuel(session.lobbyCode)) {
            sendCommandRejection(socket, "create-lobby", "invalid-state");
            return;
          }
          const code = generateLobbyCode(lobbies);
          const lobby: LobbyRecord = { code, timeLimitEnabled: false, matched: false, members: new Map() };
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

        if (message.type === "set-time-limit") {
          const lobby = session.lobbyCode ? lobbies.get(session.lobbyCode) : undefined;
          const member = session.memberId ? lobby?.members.get(session.memberId) : undefined;
          if (!lobby || member?.socket !== socket || duelCore?.hasActiveDuel(lobby.code)) {
            sendCommandRejection(socket, message.type, "invalid-state");
          } else if (member.role !== "host") {
            sendCommandRejection(socket, message.type, "not-host");
          } else {
            if (lobby.timeLimitEnabled !== message.enabled) {
              lobby.timeLimitEnabled = message.enabled;
              for (const player of lobby.members.values()) player.ready = false;
            }
            broadcastLobby(lobby);
          }
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
            timeLimitEnabled: lobby.timeLimitEnabled,
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
          await duelCore.prepareRound(lobby.code);
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
