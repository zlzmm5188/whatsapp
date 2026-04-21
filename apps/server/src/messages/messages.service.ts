import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FriendsService } from "../friends/friends.service";
import { GroupsService } from "../groups/groups.service";
import { toPublicUser } from "../users/user.mapper";
import type {
  ChatMessage,
  Conversation,
  MessageType,
  SendMessagePayload,
} from "@im/shared";
import type { Message } from "@prisma/client";

function toChatMessage(m: Message): ChatMessage {
  return {
    id: m.id,
    senderId: m.senderId,
    receiverId: m.receiverId,
    groupId: m.groupId,
    content: m.content,
    type: m.type as MessageType,
    mediaUrl: m.mediaUrl,
    mediaName: m.mediaName,
    mediaSize: m.mediaSize,
    mediaMime: m.mediaMime,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  };
}

interface SendArgs {
  content: string;
  type?: MessageType;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMime?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
    private readonly groups: GroupsService,
  ) {}

  async send(
    senderId: string,
    payload: SendMessagePayload,
  ): Promise<ChatMessage> {
    const content = (payload.content ?? "").trim();
    const type: MessageType = payload.type ?? "text";
    if (type === "text" && !content) {
      throw new ForbiddenException("empty message");
    }
    if (type !== "text" && !payload.mediaUrl) {
      throw new ForbiddenException("media message requires mediaUrl");
    }

    const hasReceiver = !!payload.receiverId;
    const hasGroup = !!payload.groupId;
    if (hasReceiver === hasGroup) {
      throw new ForbiddenException(
        "exactly one of receiverId or groupId must be set",
      );
    }

    if (hasReceiver) {
      return this.sendDM(senderId, payload.receiverId!, {
        content,
        type,
        mediaUrl: payload.mediaUrl,
        mediaName: payload.mediaName,
        mediaSize: payload.mediaSize,
        mediaMime: payload.mediaMime,
      });
    }
    return this.sendGroup(senderId, payload.groupId!, {
      content,
      type,
      mediaUrl: payload.mediaUrl,
      mediaName: payload.mediaName,
      mediaSize: payload.mediaSize,
      mediaMime: payload.mediaMime,
    });
  }

  private async sendDM(
    senderId: string,
    receiverId: string,
    args: SendArgs,
  ): Promise<ChatMessage> {
    if (senderId === receiverId) {
      throw new ForbiddenException("cannot message yourself");
    }
    const ok = await this.friends.areFriends(senderId, receiverId);
    if (!ok) {
      throw new ForbiddenException("not friends");
    }
    const created = await this.prisma.message.create({
      data: {
        senderId,
        receiverId,
        content: args.content,
        type: args.type ?? "text",
        mediaUrl: args.mediaUrl ?? null,
        mediaName: args.mediaName ?? null,
        mediaSize: args.mediaSize ?? null,
        mediaMime: args.mediaMime ?? null,
      },
    });
    return toChatMessage(created);
  }

  private async sendGroup(
    senderId: string,
    groupId: string,
    args: SendArgs,
  ): Promise<ChatMessage> {
    const isMember = await this.groups.isMember(senderId, groupId);
    if (!isMember) {
      throw new ForbiddenException("not a group member");
    }
    const created = await this.prisma.message.create({
      data: {
        senderId,
        groupId,
        content: args.content,
        type: args.type ?? "text",
        mediaUrl: args.mediaUrl ?? null,
        mediaName: args.mediaName ?? null,
        mediaSize: args.mediaSize ?? null,
        mediaMime: args.mediaMime ?? null,
      },
    });
    // Mark sender's own group message as read by themselves.
    await this.prisma.groupMessageRead.create({
      data: { messageId: created.id, userId: senderId },
    });
    // Bump group updatedAt so list() sorts correctly.
    await this.prisma.group.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    });
    return toChatMessage(created);
  }

  async history(
    meId: string,
    peerId: string,
    take: number,
    before?: string,
  ): Promise<ChatMessage[]> {
    const limit = Math.min(Math.max(take, 1), 200);
    const rows = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: meId, receiverId: peerId },
          { senderId: peerId, receiverId: meId },
        ],
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.reverse().map(toChatMessage);
  }

  async groupHistory(
    meId: string,
    groupId: string,
    take: number,
    before?: string,
  ): Promise<ChatMessage[]> {
    const isMember = await this.groups.isMember(meId, groupId);
    if (!isMember) throw new ForbiddenException("not a group member");
    const limit = Math.min(Math.max(take, 1), 200);
    const rows = await this.prisma.message.findMany({
      where: {
        groupId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.reverse().map(toChatMessage);
  }

  async markRead(meId: string, peerId: string): Promise<{ updated: number }> {
    const res = await this.prisma.message.updateMany({
      where: { senderId: peerId, receiverId: meId, read: false },
      data: { read: true },
    });
    return { updated: res.count };
  }

  async markGroupRead(
    meId: string,
    groupId: string,
  ): Promise<{ updated: number }> {
    const isMember = await this.groups.isMember(meId, groupId);
    if (!isMember) throw new ForbiddenException("not a group member");
    // Find all group messages not yet marked read by me (and not sent by me).
    const unread = await this.prisma.message.findMany({
      where: {
        groupId,
        senderId: { not: meId },
        reads: { none: { userId: meId } },
      },
      select: { id: true },
    });
    if (unread.length === 0) return { updated: 0 };
    await this.prisma.groupMessageRead.createMany({
      data: unread.map((m) => ({ messageId: m.id, userId: meId })),
    });
    return { updated: unread.length };
  }

  async conversations(meId: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    // --- DMs: one per friendship ---
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: meId }, { userBId: meId }] },
      include: { userA: true, userB: true },
    });
    for (const f of friendships) {
      const peer = f.userAId === meId ? f.userB : f.userA;
      const last = await this.prisma.message.findFirst({
        where: {
          OR: [
            { senderId: meId, receiverId: peer.id },
            { senderId: peer.id, receiverId: meId },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
      const unreadCount = await this.prisma.message.count({
        where: { senderId: peer.id, receiverId: meId, read: false },
      });
      conversations.push({
        kind: "dm",
        peer: toPublicUser(peer),
        group: null,
        lastMessage: last ? toChatMessage(last) : null,
        unreadCount,
      });
    }

    // --- Groups: one per group membership ---
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId: meId },
      include: {
        group: {
          include: { _count: { select: { members: true } } },
        },
      },
    });
    for (const m of memberships) {
      const last = await this.prisma.message.findFirst({
        where: { groupId: m.groupId },
        orderBy: { createdAt: "desc" },
      });
      const unreadCount = await this.prisma.message.count({
        where: {
          groupId: m.groupId,
          senderId: { not: meId },
          reads: { none: { userId: meId } },
        },
      });
      conversations.push({
        kind: "group",
        peer: null,
        group: {
          id: m.group.id,
          name: m.group.name,
          avatar: m.group.avatar,
          description: m.group.description,
          ownerId: m.group.ownerId,
          memberCount: m.group._count.members,
          createdAt: m.group.createdAt.toISOString(),
        },
        lastMessage: last ? toChatMessage(last) : null,
        unreadCount,
      });
    }

    conversations.sort((a, b) => {
      const ta = a.lastMessage ? Date.parse(a.lastMessage.createdAt) : 0;
      const tb = b.lastMessage ? Date.parse(b.lastMessage.createdAt) : 0;
      return tb - ta;
    });
    return conversations;
  }

  async getGroupMessage(id: string) {
    const m = await this.prisma.message.findUnique({ where: { id } });
    if (!m) throw new NotFoundException("message not found");
    return m;
  }
}
