import { randomInt } from "node:crypto";

import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

type ClientMessage =
  | { type: "ping" }
  | { type: "create-room"; clientId: string }
  | { type: "join-room"; clientId: string; roomCode: string }
  | { type: "set-ready"; ready: boolean }
  | { type: "start-game" }
  | { type: "leave-room" };

type RoomMember = {
  id: string;
  name: string;
  role: "host" | "opponent";
  connected: boolean;
  ready: boolean;
};

type MemberRecord = RoomMember & {
  socket?: WebSocket;
};

type RoomRecord = {
  code: string;
  matched: boolean;
  members: Map<string, MemberRecord>;
};

type SocketSession = {
  memberId?: string;
  roomCode?: string;
};

const ROOM_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function serializeMessage(message: object): string {
  return JSON.stringify({
    ...message,
    sentAt: new Date().toISOString(),
  });
}

function generateRoomCode(rooms: Map<string, RoomRecord>): string {
  let code = "";

  do {
    code = Array.from(
      { length: 5 },
      () => ROOM_CODE_CHARACTERS[randomInt(ROOM_CODE_CHARACTERS.length)],
    ).join("");
  } while (rooms.has(code));

  return code;
}

function roomState(room: RoomRecord): string {
  return serializeMessage({
    type: "room-state",
    room: {
      code: room.code,
      members: Array.from(room.members.values(), ({ socket: _socket, ...member }) => member),
    },
  });
}

function broadcastRoom(room: RoomRecord): void {
  const message = roomState(room);

  for (const member of room.members.values()) {
    if (member.connected && member.socket?.readyState === 1) {
      member.socket.send(message);
    }
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const rooms = new Map<string, RoomRecord>();

  await app.register(websocket);

  app.get("/", async () => ({ name: "wikiduel-server", status: "ok" }));
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ws", { websocket: true }, (socket) => {
    const session: SocketSession = {};

    socket.send(serializeMessage({ type: "welcome", message: "Connected to WikiDuel server" }));

    const leaveCurrentRoom = () => {
      if (!session.roomCode || !session.memberId) return;

      const room = rooms.get(session.roomCode);
      const member = room?.members.get(session.memberId);

      if (room && member?.socket === socket) {
        if (room.matched) {
          rooms.delete(room.code);

          for (const remainingMember of room.members.values()) {
            if (
              remainingMember.id !== member.id
              && remainingMember.connected
              && remainingMember.socket?.readyState === 1
            ) {
              remainingMember.socket.send(serializeMessage({
                type: "room-closed",
                message: "The other player left. The lobby has been closed.",
              }));
            }
          }
        } else {
          room.members.delete(member.id);
          if (room.members.size === 0) rooms.delete(room.code);
        }
      }

      session.roomCode = undefined;
      session.memberId = undefined;
    };

    const joinRoom = (room: RoomRecord, clientId: string, role: "host" | "opponent") => {
      leaveCurrentRoom();

      const existingMember = room.members.get(clientId);
      const member: MemberRecord = existingMember ?? {
        id: clientId,
        name: role === "host" ? "host" : "Opponent",
        role,
        connected: true,
        ready: false,
      };

      member.connected = true;
      member.socket = socket;
      room.members.set(member.id, member);
      session.roomCode = room.code;
      session.memberId = member.id;
      if (room.members.size === 2) room.matched = true;
      broadcastRoom(room);
    };

    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;

        if (message.type === "ping") {
          socket.send(serializeMessage({ type: "pong", message: "Pong from WikiDuel server" }));
          return;
        }

        if (message.type === "create-room") {
          const code = generateRoomCode(rooms);
          const room: RoomRecord = { code, matched: false, members: new Map() };
          rooms.set(code, room);
          joinRoom(room, message.clientId, "host");
          return;
        }

        if (message.type === "join-room") {
          const code = message.roomCode.trim().toUpperCase();
          const room = rooms.get(code);

          if (!room) {
            socket.send(serializeMessage({ type: "room-error", message: "Lobby not found" }));
            return;
          }

          if (!room.members.has(message.clientId) && room.members.size >= 2) {
            socket.send(serializeMessage({ type: "room-error", message: "Lobby is full" }));
            return;
          }

          joinRoom(room, message.clientId, "opponent");
          return;
        }

        if (message.type === "set-ready") {
          if (!session.roomCode || !session.memberId) return;

          const room = rooms.get(session.roomCode);
          const member = room?.members.get(session.memberId);
          if (!room || !member) return;

          member.ready = message.ready;
          broadcastRoom(room);
          return;
        }

        if (message.type === "start-game") {
          if (!session.roomCode || !session.memberId) return;

          const room = rooms.get(session.roomCode);
          const member = room?.members.get(session.memberId);
          const canStart = room
            && member?.role === "host"
            && room.members.size === 2
            && Array.from(room.members.values()).every(
              (roomMember) => roomMember.connected && roomMember.ready,
            );

          if (room && canStart) {
            const startedMessage = serializeMessage({ type: "game-started" });
            for (const roomMember of room.members.values()) {
              if (roomMember.socket?.readyState === 1) roomMember.socket.send(startedMessage);
            }
          }
          return;
        }

        if (message.type === "leave-room") {
          leaveCurrentRoom();
        }
      } catch {
        socket.send(serializeMessage({ type: "room-error", message: "Invalid message" }));
      }
    });

    socket.on("close", leaveCurrentRoom);
  });

  return app;
}
