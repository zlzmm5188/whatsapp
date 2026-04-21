import { Inject, Logger, forwardRef } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";
import { MessagesService } from "../messages/messages.service";
import { GroupsService } from "../groups/groups.service";
import {
  MarkReadPayload,
  SendMessagePayload,
  SocketEvents,
  TypingPayload,
} from "@im/shared";

interface AuthedSocket extends Socket {
  data: { userId: string };
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
      .split(",")
      .map((o) => o.trim()),
    credentials: true,
  },
  maxHttpBufferSize: 2 * 1024 * 1024, // 2 MiB — media is uploaded via HTTP; socket carries URLs only
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  // userId -> set of socket ids
  private readonly sockets = new Map<string, Set<string>>();

  constructor(
    private readonly auth: AuthService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messages: MessagesService,
    @Inject(forwardRef(() => GroupsService))
    private readonly groups: GroupsService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.replace(/^Bearer /i, "") ??
        undefined);
    if (!token) {
      socket.emit("error", { message: "missing token" });
      socket.disconnect(true);
      return;
    }
    const userId = await this.auth.verifyToken(token);
    if (!userId) {
      socket.emit("error", { message: "invalid token" });
      socket.disconnect(true);
      return;
    }
    (socket as AuthedSocket).data.userId = userId;
    socket.join(`user:${userId}`);

    // Join group rooms so the user receives group events without extra round-trips.
    const groupIds = await this.groups.myGroupIds(userId);
    for (const gid of groupIds) {
      socket.join(`group:${gid}`);
    }

    const wasOnline = this.sockets.has(userId);
    let set = this.sockets.get(userId);
    if (!set) {
      set = new Set<string>();
      this.sockets.set(userId, set);
    }
    set.add(socket.id);

    this.logger.log(`user ${userId} connected (${socket.id})`);
    if (!wasOnline) {
      this.broadcastPresence(userId, true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const userId = (socket as AuthedSocket).data?.userId;
    if (!userId) return;
    const set = this.sockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        this.sockets.delete(userId);
        this.broadcastPresence(userId, false);
      }
    }
    this.logger.log(`user ${userId} disconnected (${socket.id})`);
  }

  @SubscribeMessage(SocketEvents.SendMessage)
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<{ ok: boolean; error?: string }> {
    const userId = (socket as AuthedSocket).data.userId;
    try {
      const msg = await this.messages.send(userId, payload);
      if (msg.receiverId) {
        // DM: push to receiver + echo to sender's own sessions.
        this.server
          .to(`user:${msg.receiverId}`)
          .emit(SocketEvents.NewMessage, {
            ...msg,
            clientId: payload.clientId,
          });
        this.server.to(`user:${userId}`).emit(SocketEvents.NewMessage, {
          ...msg,
          clientId: payload.clientId,
        });
      } else if (msg.groupId) {
        // Group: push to the group room (members joined on connect).
        this.server.to(`group:${msg.groupId}`).emit(SocketEvents.NewMessage, {
          ...msg,
          clientId: payload.clientId,
        });
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "send failed";
      return { ok: false, error: message };
    }
  }

  @SubscribeMessage(SocketEvents.MarkRead)
  async onMarkRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: MarkReadPayload,
  ): Promise<{ ok: boolean }> {
    const userId = (socket as AuthedSocket).data.userId;
    if (payload?.peerId) {
      await this.messages.markRead(userId, payload.peerId);
      this.server
        .to(`user:${payload.peerId}`)
        .emit(SocketEvents.MessageRead, { peerId: userId });
      return { ok: true };
    }
    if (payload?.groupId) {
      await this.messages.markGroupRead(userId, payload.groupId);
      return { ok: true };
    }
    return { ok: false };
  }

  @SubscribeMessage(SocketEvents.Typing)
  onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: TypingPayload,
  ): void {
    const userId = (socket as AuthedSocket).data.userId;
    if (payload?.peerId) {
      this.server.to(`user:${payload.peerId}`).emit(SocketEvents.PeerTyping, {
        peerId: userId,
        typing: !!payload.typing,
      });
      return;
    }
    if (payload?.groupId) {
      this.server
        .to(`group:${payload.groupId}`)
        .except(`user:${userId}`)
        .emit(SocketEvents.PeerTyping, {
          peerId: userId,
          groupId: payload.groupId,
          typing: !!payload.typing,
        });
    }
  }

  // --- Helpers used by GroupsService to emit on membership changes ---

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToGroup(groupId: string, event: string, data: unknown): void {
    this.server.to(`group:${groupId}`).emit(event, data);
  }

  joinUserToGroup(userId: string, groupId: string): void {
    const sockets = this.sockets.get(userId);
    if (!sockets) return;
    for (const sid of sockets) {
      const s = this.server.sockets.sockets.get(sid);
      s?.join(`group:${groupId}`);
    }
  }

  removeUserFromGroup(userId: string, groupId: string): void {
    const sockets = this.sockets.get(userId);
    if (!sockets) return;
    for (const sid of sockets) {
      const s = this.server.sockets.sockets.get(sid);
      s?.leave(`group:${groupId}`);
    }
  }

  private broadcastPresence(userId: string, online: boolean): void {
    this.server.emit(SocketEvents.Presence, { userId, online });
  }
}
