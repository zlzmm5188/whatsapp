import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FriendsService } from "../friends/friends.service";
import { toPublicUser } from "../users/user.mapper";
import type { ChatMessage, Conversation, MessageType } from "@im/shared";
import type { Message } from "@prisma/client";

function toChatMessage(m: Message): ChatMessage {
  return {
    id: m.id,
    senderId: m.senderId,
    receiverId: m.receiverId,
    content: m.content,
    type: m.type as MessageType,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  };
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  async send(
    senderId: string,
    receiverId: string,
    content: string,
    type: MessageType = "text",
  ): Promise<ChatMessage> {
    if (senderId === receiverId) {
      throw new ForbiddenException("cannot message yourself");
    }
    const ok = await this.friends.areFriends(senderId, receiverId);
    if (!ok) {
      throw new ForbiddenException("not friends");
    }
    const created = await this.prisma.message.create({
      data: { senderId, receiverId, content, type },
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

  async markRead(meId: string, peerId: string): Promise<{ updated: number }> {
    const res = await this.prisma.message.updateMany({
      where: { senderId: peerId, receiverId: meId, read: false },
      data: { read: true },
    });
    return { updated: res.count };
  }

  async conversations(meId: string): Promise<Conversation[]> {
    // Load all friendships, then for each peer compute last message + unread count.
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: meId }, { userBId: meId }] },
      include: { userA: true, userB: true },
    });

    const conversations: Conversation[] = [];
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
        peer: toPublicUser(peer),
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
}
