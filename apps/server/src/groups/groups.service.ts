import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type { Group, GroupMember, User } from "@prisma/client";
import type {
  GroupDetail,
  GroupMemberDTO,
  GroupSummary,
  PublicUser,
} from "@im/shared";
import { SocketEvents } from "@im/shared";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "../users/user.mapper";
import { ChatGateway } from "../chat/chat.gateway";

type MemberWithUser = GroupMember & { user: User };
type GroupWithMembers = Group & {
  members: MemberWithUser[];
  _count?: { members: number };
};

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chat: ChatGateway,
  ) {}

  async create(
    ownerId: string,
    name: string,
    memberIds: string[],
    description?: string,
    avatar?: string,
  ): Promise<GroupDetail> {
    const unique = Array.from(new Set(memberIds.filter((id) => id && id !== ownerId)));
    if (unique.length === 0) {
      throw new BadRequestException("group must have at least 1 other member");
    }

    // Verify all memberIds are friends of the creator to prevent spam-adding.
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { userAId: ownerId, userBId: { in: unique } },
          { userBId: ownerId, userAId: { in: unique } },
        ],
      },
    });
    const friendIds = new Set(
      friendships.map((f) => (f.userAId === ownerId ? f.userBId : f.userAId)),
    );
    for (const id of unique) {
      if (!friendIds.has(id)) {
        throw new BadRequestException(`user ${id} is not your friend`);
      }
    }

    const group = await this.prisma.group.create({
      data: {
        name,
        description: description ?? null,
        avatar: avatar ?? null,
        ownerId,
        members: {
          create: [
            { userId: ownerId, role: "owner" },
            ...unique.map((userId) => ({ userId, role: "member" })),
          ],
        },
      },
      include: {
        members: { include: { user: true } },
        _count: { select: { members: true } },
      },
    });

    const detail = toGroupDetail(group);

    // Notify all members (owner included) that they were added to a new group.
    for (const m of detail.members) {
      this.chat.emitToUser(m.userId, SocketEvents.GroupCreated, detail);
      this.chat.joinUserToGroup(m.userId, group.id);
    }

    return detail;
  }

  async list(meId: string): Promise<GroupSummary[]> {
    const rows = await this.prisma.group.findMany({
      where: { members: { some: { userId: meId } } },
      include: { _count: { select: { members: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toGroupSummary);
  }

  async get(meId: string, groupId: string): Promise<GroupDetail> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: true } },
        _count: { select: { members: true } },
      },
    });
    if (!group) throw new NotFoundException("group not found");
    if (!group.members.some((m) => m.userId === meId)) {
      throw new ForbiddenException("not a member");
    }
    return toGroupDetail(group);
  }

  async addMembers(
    meId: string,
    groupId: string,
    memberIds: string[],
  ): Promise<GroupDetail> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException("group not found");
    if (!group.members.some((m) => m.userId === meId)) {
      throw new ForbiddenException("not a member");
    }

    const existing = new Set(group.members.map((m) => m.userId));
    const toAdd = Array.from(
      new Set(memberIds.filter((id) => id && !existing.has(id))),
    );
    if (toAdd.length === 0) {
      return this.get(meId, groupId);
    }

    // Inviter must be friends with each invited user.
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { userAId: meId, userBId: { in: toAdd } },
          { userBId: meId, userAId: { in: toAdd } },
        ],
      },
    });
    const friendIds = new Set(
      friendships.map((f) => (f.userAId === meId ? f.userBId : f.userAId)),
    );
    for (const id of toAdd) {
      if (!friendIds.has(id)) {
        throw new BadRequestException(`user ${id} is not your friend`);
      }
    }

    await this.prisma.groupMember.createMany({
      data: toAdd.map((userId) => ({ groupId, userId, role: "member" })),
    });

    const detail = await this.get(meId, groupId);
    for (const userId of toAdd) {
      this.chat.joinUserToGroup(userId, groupId);
      this.chat.emitToUser(userId, SocketEvents.GroupCreated, detail);
    }
    this.chat.emitToGroup(groupId, SocketEvents.GroupMembersChanged, detail);
    return detail;
  }

  async removeMember(
    meId: string,
    groupId: string,
    userId: string,
  ): Promise<GroupDetail> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException("group not found");

    // Owner can remove anyone (except themselves); members can only remove
    // themselves (leave).
    if (userId !== meId && group.ownerId !== meId) {
      throw new ForbiddenException("only owner can remove members");
    }
    if (userId === group.ownerId) {
      throw new BadRequestException(
        "owner cannot leave; delete the group instead",
      );
    }
    await this.prisma.groupMember.deleteMany({
      where: { groupId, userId },
    });
    this.chat.removeUserFromGroup(userId, groupId);

    const detail = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: true } },
        _count: { select: { members: true } },
      },
    });
    if (!detail) throw new NotFoundException("group missing after update");
    const dto = toGroupDetail(detail);
    this.chat.emitToGroup(groupId, SocketEvents.GroupMembersChanged, dto);
    return dto;
  }

  async isMember(userId: string, groupId: string): Promise<boolean> {
    const row = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    return !!row;
  }

  async memberIds(groupId: string): Promise<string[]> {
    const rows = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async myGroupIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return rows.map((r) => r.groupId);
  }
}

function toGroupSummary(
  g: Group & { _count?: { members: number } },
): GroupSummary {
  return {
    id: g.id,
    name: g.name,
    avatar: g.avatar,
    description: g.description,
    ownerId: g.ownerId,
    memberCount: g._count?.members ?? 0,
    createdAt: g.createdAt.toISOString(),
  };
}

function toGroupDetail(g: GroupWithMembers): GroupDetail {
  const members: GroupMemberDTO[] = g.members.map((m) => ({
    userId: m.userId,
    role: m.role as "owner" | "admin" | "member",
    joinedAt: m.joinedAt.toISOString(),
    user: toPublicUser(m.user),
  }));
  return {
    ...toGroupSummary({ ...g, _count: g._count }),
    memberCount: members.length,
    members,
  };
}
