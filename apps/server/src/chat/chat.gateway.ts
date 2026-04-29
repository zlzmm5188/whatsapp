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
import { FriendsService } from "../friends/friends.service";
import { MessagesService } from "../messages/messages.service";
import { GroupsService } from "../groups/groups.service";
import { UsersService } from "../users/users.service";
import {
  CallAcceptPayload,
  CallCancelPayload,
  CallEndPayload,
  CallIcePayload,
  CallInvitePayload,
  CallRejectPayload,
  CallSdpPayload,
  IncomingCallPayload,
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
@WebSocketGateway({
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

  // Active calls: callId -> { caller, callee }. Used for in-call routing
  // and to detect "busy" state when a new invite arrives for someone who
  // already has a call.
  private readonly activeCalls = new Map<
    string,
    { caller: string; callee: string }
  >();

  constructor(
    private readonly auth: AuthService,
    private readonly friends: FriendsService,
    private readonly users: UsersService,
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
      // End any active calls this user was part of: notify the peer so
      // they can tear down their RTCPeerConnection and stop ringing.
      for (const [callId, call] of this.activeCalls) {
        if (call.caller === userId || call.callee === userId) {
          const peerId = call.caller === userId ? call.callee : call.caller;
          this.server.to(`user:${peerId}`).emit(SocketEvents.CallEnd, {
            callId,
            peerId: userId,
          });
          this.activeCalls.delete(callId);
        }
      }
      await this.broadcastPresence(userId, false);
    }
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
        // DM: deliver to receiver + echo to sender's other tabs/devices in a
        // single emit. Socket.IO deduplicates room membership, so each
        // socket gets exactly one copy even if both rooms resolve to the
        // same connection. clientId lets the sender reconcile the optimistic
        // bubble.
        this.server
          .to([`user:${msg.receiverId}`, `user:${userId}`])
          .emit(SocketEvents.NewMessage, {
            ...msg,
            clientId: payload.clientId,
          });
      } else if (msg.groupId) {
        // Group: push to the group room (members joined on connect). Room
        // membership is per-socket, so the sender's own sessions also
        // receive it through this one emit.
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

  // ---- Call signaling (1:1 audio/video). The server is a dumb relay:
  // it validates that two users are friends and routes events between them.
  // It does NOT keep media; WebRTC traffic flows P2P (via TURN if needed).

  @SubscribeMessage(SocketEvents.CallInvite)
  async onCallInvite(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CallInvitePayload,
  ): Promise<{ ok: boolean; error?: string }> {
    const userId = (socket as AuthedSocket).data.userId;
    if (!payload?.callId || !payload?.peerId || !payload?.kind) {
      return { ok: false, error: "invalid payload" };
    }
    if (payload.peerId === userId) {
      return { ok: false, error: "cannot call self" };
    }
    const friends = await this.friends.areFriends(userId, payload.peerId);
    if (!friends) return { ok: false, error: "not friends" };

    // If callee is already in another call, signal busy back to caller
    // and don't ring.
    const calleeBusy = Array.from(this.activeCalls.values()).some(
      (c) => c.caller === payload.peerId || c.callee === payload.peerId,
    );
    if (calleeBusy) {
      socket.emit(SocketEvents.CallBusy, {
        callId: payload.callId,
        peerId: payload.peerId,
      });
      return { ok: false, error: "busy" };
    }

    const fromUser = await this.users.getById(userId);
    if (!fromUser) return { ok: false, error: "caller not found" };

    this.activeCalls.set(payload.callId, {
      caller: userId,
      callee: payload.peerId,
    });

    const incoming: IncomingCallPayload = {
      callId: payload.callId,
      fromUser,
      kind: payload.kind,
    };
    this.server
      .to(`user:${payload.peerId}`)
      .emit(SocketEvents.CallInvite, incoming);
    return { ok: true };
  }

  @SubscribeMessage(SocketEvents.CallAccept)
  onCallAccept(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CallAcceptPayload,
  ): { ok: boolean } {
    const userId = (socket as AuthedSocket).data.userId;
    if (!this.isCallParticipant(payload?.callId, userId, payload?.peerId)) {
      return { ok: false };
    }
    this.server.to(`user:${payload.peerId}`).emit(SocketEvents.CallAccept, {
      callId: payload.callId,
      peerId: userId,
    });
    return { ok: true };
  }

  @SubscribeMessage(SocketEvents.CallReject)
  onCallReject(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CallRejectPayload,
  ): { ok: boolean } {
    const userId = (socket as AuthedSocket).data.userId;
    if (!this.isCallParticipant(payload?.callId, userId, payload?.peerId)) {
      return { ok: false };
    }
    this.activeCalls.delete(payload.callId);
    this.server.to(`user:${payload.peerId}`).emit(SocketEvents.CallReject, {
      callId: payload.callId,
      peerId: userId,
      reason: payload.reason ?? "declined",
    });
    return { ok: true };
  }

  @SubscribeMessage(SocketEvents.CallCancel)
  onCallCancel(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CallCancelPayload,
  ): { ok: boolean } {
    const userId = (socket as AuthedSocket).data.userId;
    if (!this.isCallParticipant(payload?.callId, userId, payload?.peerId)) {
      return { ok: false };
    }
    this.activeCalls.delete(payload.callId);
    this.server.to(`user:${payload.peerId}`).emit(SocketEvents.CallCancel, {
      callId: payload.callId,
      peerId: userId,
    });
    return { ok: true };
  }

  @SubscribeMessage(SocketEvents.CallEnd)
  onCallEnd(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CallEndPayload,
  ): { ok: boolean } {
    const userId = (socket as AuthedSocket).data.userId;
    if (!this.isCallParticipant(payload?.callId, userId, payload?.peerId)) {
      return { ok: false };
    }
    this.activeCalls.delete(payload.callId);
    this.server.to(`user:${payload.peerId}`).emit(SocketEvents.CallEnd, {
      callId: payload.callId,
      peerId: userId,
    });
    return { ok: true };
  }

  @SubscribeMessage(SocketEvents.CallSdp)
  onCallSdp(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CallSdpPayload,
  ): { ok: boolean } {
    const userId = (socket as AuthedSocket).data.userId;
    if (!this.isCallParticipant(payload?.callId, userId, payload?.peerId)) {
      return { ok: false };
    }
    this.server.to(`user:${payload.peerId}`).emit(SocketEvents.CallSdp, {
      callId: payload.callId,
      peerId: userId,
      sdp: payload.sdp,
    });
    return { ok: true };
  }

  @SubscribeMessage(SocketEvents.CallIce)
  onCallIce(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CallIcePayload,
  ): { ok: boolean } {
    const userId = (socket as AuthedSocket).data.userId;
    if (!this.isCallParticipant(payload?.callId, userId, payload?.peerId)) {
      return { ok: false };
    }
    this.server.to(`user:${payload.peerId}`).emit(SocketEvents.CallIce, {
      callId: payload.callId,
      peerId: userId,
      candidate: payload.candidate,
    });
    return { ok: true };
  }

  // Confirms (a) the call exists, (b) the sender is one of the two
  // participants, and (c) the claimed `peerId` is the other participant.
  // Prevents one user from spoofing signaling to a third party.
  private isCallParticipant(
    callId: string | undefined,
    senderId: string,
    claimedPeerId: string | undefined,
  ): boolean {
    if (!callId || !claimedPeerId) return false;
    const call = this.activeCalls.get(callId);
    if (!call) return false;
    if (call.caller === senderId && call.callee === claimedPeerId) return true;
    if (call.callee === senderId && call.caller === claimedPeerId) return true;
    return false;
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
