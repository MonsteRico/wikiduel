import { randomInt } from "node:crypto";

import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

import type { PlayableArticleRepository } from "./playable-articles/repository.js";
import {
  buildPreviewDiagnostics,
  isPreviewRequest,
  previewArticleResult,
  previewError,
  type PreviewArticleRequest,
} from "./playable-articles/preview.js";

export type BuildAppOptions = Readonly<{
  repository?: PlayableArticleRepository;
  production?: boolean;
}>;

type ClientMessage =
  | { type: "ping" }
  | { type: "create-lobby"; clientId: string }
  | { type: "join-lobby"; clientId: string; lobbyCode: string }
  | { type: "set-ready"; ready: boolean }
  | { type: "start-game" }
  | { type: "leave-lobby" };

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

    const leaveCurrentLobby = () => {
      if (!session.lobbyCode || !session.memberId) return;

      const lobby = lobbies.get(session.lobbyCode);
      const member = lobby?.members.get(session.memberId);

      if (lobby && member?.socket === socket) {
        if (lobby.matched) {
          lobbies.delete(lobby.code);

          for (const remainingMember of lobby.members.values()) {
            if (
              remainingMember.id !== member.id
              && remainingMember.connected
              && remainingMember.socket?.readyState === 1
            ) {
              remainingMember.socket.send(serializeMessage({
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

        if (isPreviewMessage(parsedMessage)) {
          const hints = previewRequestHints(parsedMessage);
          if (!isPreviewRequest(parsedMessage)) {
            socket.send(serializeMessage(previewError(hints, "malformed-message")));
            return;
          }
          if (options.production || !options.repository) {
            socket.send(serializeMessage(previewError(parsedMessage, "preview-unavailable")));
            return;
          }

          const startedAt = performance.now();
          let lookup;
          try {
            lookup = options.repository.getByTitleWithDiagnostics
              ? await options.repository.getByTitleWithDiagnostics(parsedMessage.requestedTitle)
              : {
                result: await options.repository.getByTitle(parsedMessage.requestedTitle),
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
            parsedMessage.requestedTitle,
            lookup.result,
            performance.now() - startedAt,
            lookup.cacheOutcome,
            lookup.details,
          );
          socket.send(serializeMessage(previewArticleResult(parsedMessage, lookup.result, diagnostics)));
          return;
        }

        const message = parsedMessage as ClientMessage;

        if (message.type === "ping") {
          socket.send(serializeMessage({ type: "pong", message: "Pong from WikiDuel server" }));
          return;
        }

        if (message.type === "create-lobby") {
          const code = generateLobbyCode(lobbies);
          const lobby: LobbyRecord = { code, matched: false, members: new Map() };
          lobbies.set(code, lobby);
          joinLobby(lobby, message.clientId, "host");
          return;
        }

        if (message.type === "join-lobby") {
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

          const lobby = lobbies.get(session.lobbyCode);
          const member = lobby?.members.get(session.memberId);
          if (!lobby || !member) return;

          member.ready = message.ready;
          broadcastLobby(lobby);
          return;
        }

        if (message.type === "start-game") {
          if (!session.lobbyCode || !session.memberId) return;

          const lobby = lobbies.get(session.lobbyCode);
          const member = lobby?.members.get(session.memberId);
          const canStart = lobby
            && member?.role === "host"
            && lobby.members.size === 2
            && Array.from(lobby.members.values()).every(
              (lobbyMember) => lobbyMember.connected && lobbyMember.ready,
            );

          if (lobby && canStart) {
            const startedMessage = serializeMessage({ type: "game-started" });
            for (const lobbyMember of lobby.members.values()) {
              if (lobbyMember.socket?.readyState === 1) lobbyMember.socket.send(startedMessage);
            }
          }
          return;
        }

        if (message.type === "leave-lobby") {
          leaveCurrentLobby();
        }
      } catch {
        socket.send(serializeMessage({ type: "lobby-error", message: "Invalid message" }));
      }
    });

    socket.on("close", leaveCurrentLobby);
  });

  return app;
}
