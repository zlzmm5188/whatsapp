import { Logger } from "@nestjs/common";
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
import { FriendsService } from "../friends/friends.service";
import { MessagesService } from "../messages/messages.service";
import {
  MarkReadPayload,
  SendMessagePayload,
  SocketEvents,
  TypingPayload,
} from "@im/shared";

interface AuthedSocket extends Socket {
  data: { userId: string };
}

// NOTE: CORS for Socket.IO is configured in main.ts via a custom IoAdapter,
// because `@WebSocketGateway({ cors })` is evaluated at class-decoration time
// — which happens during module import, BEFORE ConfigModule.forRoot() loads
// `.env`, so `process.env.CORS_ORIGIN` would always be undefined here.
@WebSocketGateway()
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
    private readonly friends: FriendsService,
    private readonly messages: MessagesService,
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

    const wasOnline = this.sockets.has(userId);
    let set = this.sockets.get(userId);
    if (!set) {
      set = new Set<string>();
      this.sockets.set(userId, set);
    }
    set.add(socket.id);

    this.logger.log(`user ${userId} connected (${socket.id})`);
    if (!wasOnline) {
      await this.broadcastPresence(userId, true);
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const userId = (socket as AuthedSocket).data?.userId;
    if (!userId) return;
    const set = this.sockets.get(userId);
    let wentOffline = false;
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        this.sockets.delete(userId);
        wentOffline = true;
      }
    }
    this.logger.log(`user ${userId} disconnected (${socket.id})`);
    if (wentOffline) {
      await this.broadcastPresence(userId, false);
    }
  }

  @SubscribeMessage(SocketEvents.SendMessage)
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<{ ok: boolean; error?: string }> {
    const userId = (socket as AuthedSocket).data.userId;
    if (!payload?.receiverId || !payload?.content?.trim()) {
      return { ok: false, error: "invalid payload" };
    }
    try {
      const msg = await this.messages.send(
        userId,
        payload.receiverId,
        payload.content.trim(),
        payload.type ?? "text",
      );
      // Deliver to receiver + echo to sender's other tabs/devices in a single
      // emit. Socket.IO deduplicates rooms internally, so if for any reason
      // both rooms resolve to the same socket set, each socket still only
      // gets one copy. clientId lets the sender reconcile the optimistic
      // bubble.
      this.server
        .to([`user:${payload.receiverId}`, `user:${userId}`])
        .emit(SocketEvents.NewMessage, {
          ...msg,
          clientId: payload.clientId,
        });
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
    if (!payload?.peerId) return { ok: false };
    await this.messages.markRead(userId, payload.peerId);
    // tell the peer that their messages to me have been read
    this.server
      .to(`user:${payload.peerId}`)
      .emit(SocketEvents.MessageRead, { peerId: userId });
    return { ok: true };
  }

  @SubscribeMessage(SocketEvents.Typing)
  onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: TypingPayload,
  ): void {
    const userId = (socket as AuthedSocket).data.userId;
    if (!payload?.peerId) return;
    this.server.to(`user:${payload.peerId}`).emit(SocketEvents.PeerTyping, {
      peerId: userId,
      typing: !!payload.typing,
    });
  }

  private async broadcastPresence(
    userId: string,
    online: boolean,
  ): Promise<void> {
    // Only notify this user's friends — not every connected socket. Also echo
    // to the user's own sockets so their multi-tab sessions see a consistent
    // self-presence.
    const friends = await this.friends.friendIds(userId);
    const rooms = [`user:${userId}`, ...friends.map((id) => `user:${id}`)];
    this.server.to(rooms).emit(SocketEvents.Presence, { userId, online });
  }
}
