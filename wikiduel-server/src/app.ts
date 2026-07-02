import { randomInt, randomUUID } from "node:crypto";

import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

type ClientMessage =
  | { type: "ping" }
  | { type: "create-room"; clientId: string }
  | { type: "join-room"; clientId: string; roomCode: string }
  | { type: "leave-room" };

type RoomMember = {
  id: string;
  name: string;
  connected: boolean;
};

type MemberRecord = RoomMember & {
  socket?: WebSocket;
};

type RoomRecord = {
  code: string;
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
        member.connected = false;
        member.socket = undefined;
        broadcastRoom(room);
      }

      session.roomCode = undefined;
      session.memberId = undefined;
    };

    const joinRoom = (room: RoomRecord, clientId: string, isHost: boolean) => {
      leaveCurrentRoom();

      const existingMember = room.members.get(clientId);
      const member: MemberRecord = existingMember ?? {
        id: clientId || randomUUID(),
        name: isHost ? "Host" : `Player ${room.members.size + 1}`,
        connected: true,
      };

      member.connected = true;
      member.socket = socket;
      room.members.set(member.id, member);
      session.roomCode = room.code;
      session.memberId = member.id;
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
          const room: RoomRecord = { code, members: new Map() };
          rooms.set(code, room);
          joinRoom(room, message.clientId, true);
          return;
        }

        if (message.type === "join-room") {
          const code = message.roomCode.trim().toUpperCase();
          const room = rooms.get(code);

          if (!room) {
            socket.send(serializeMessage({ type: "room-error", message: "Room not found" }));
            return;
          }

          joinRoom(room, message.clientId, false);
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
