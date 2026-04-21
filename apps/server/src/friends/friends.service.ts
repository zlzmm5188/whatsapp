import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "../users/user.mapper";
import type { FriendRequestDTO, PublicUser } from "@im/shared";

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(meId: string): Promise<PublicUser[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: meId }, { userBId: meId }] },
      include: { userA: true, userB: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => toPublicUser(r.userAId === meId ? r.userB : r.userA));
  }

  async incomingRequests(meId: string): Promise<FriendRequestDTO[]> {
    const rows = await this.prisma.friendRequest.findMany({
      where: { toId: meId, status: "pending" },
      include: { from: true, to: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      fromId: r.fromId,
      toId: r.toId,
      message: r.message,
      status: r.status as "pending" | "accepted" | "rejected",
      createdAt: r.createdAt.toISOString(),
      from: toPublicUser(r.from),
      to: toPublicUser(r.to),
    }));
  }

  async sendRequest(
    meId: string,
    toUsername: string,
    message?: string,
  ): Promise<FriendRequestDTO> {
    const target = await this.prisma.user.findUnique({
      where: { username: toUsername },
    });
    if (!target) throw new NotFoundException("user not found");
    if (target.id === meId) {
      throw new BadRequestException("cannot add yourself");
    }

    const already = await this.areFriends(meId, target.id);
    if (already) throw new ConflictException("already friends");

    // Prior rows may exist in both directions after repeated add/reject/remove
    // cycles. Look up EACH direction independently so we always know whether
    // "my" direction needs to be updated vs. created — and whether the other
    // direction currently has a pending request from the target.
    const [mineToThem, theirToMe] = await Promise.all([
      this.prisma.friendRequest.findUnique({
        where: { fromId_toId: { fromId: meId, toId: target.id } },
      }),
      this.prisma.friendRequest.findUnique({
        where: { fromId_toId: { fromId: target.id, toId: meId } },
      }),
    ]);
    if (mineToThem && mineToThem.status === "pending") {
      throw new ConflictException("request already pending");
    }
    if (theirToMe && theirToMe.status === "pending") {
      throw new ConflictException(
        "the other user already sent you a request; accept it instead",
      );
    }

    // Atomic create-or-update on the (fromId, toId) unique key. This is safe
    // even when a row in the opposite direction exists.
    const req = await this.prisma.friendRequest.upsert({
      where: { fromId_toId: { fromId: meId, toId: target.id } },
      create: {
        fromId: meId,
        toId: target.id,
        message: message ?? null,
      },
      update: {
        status: "pending",
        message: message ?? null,
      },
      include: { from: true, to: true },
    });

    return {
      id: req.id,
      fromId: req.fromId,
      toId: req.toId,
      message: req.message,
      status: req.status as "pending" | "accepted" | "rejected",
      createdAt: req.createdAt.toISOString(),
      from: toPublicUser(req.from),
      to: toPublicUser(req.to),
    };
  }

  async accept(meId: string, requestId: string): Promise<PublicUser> {
    const req = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: { from: true },
    });
    if (!req) throw new NotFoundException("request not found");
    if (req.toId !== meId) throw new BadRequestException("not your request");
    if (req.status !== "pending") {
      throw new BadRequestException("request is not pending");
    }

    const [userAId, userBId] = [req.fromId, req.toId].sort();

    await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: req.id },
        data: { status: "accepted" },
      }),
      this.prisma.friendship.upsert({
        where: {
          userAId_userBId: { userAId: userAId!, userBId: userBId! },
        },
        create: { userAId: userAId!, userBId: userBId! },
        update: {},
      }),
    ]);

    return toPublicUser(req.from);
  }

  async reject(meId: string, requestId: string): Promise<{ ok: true }> {
    const req = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException("request not found");
    if (req.toId !== meId) throw new BadRequestException("not your request");
    if (req.status !== "pending") {
      throw new BadRequestException("request is not pending");
    }
    await this.prisma.friendRequest.update({
      where: { id: req.id },
      data: { status: "rejected" },
    });
    return { ok: true };
  }

  async remove(meId: string, friendId: string): Promise<{ ok: true }> {
    const [userAId, userBId] = [meId, friendId].sort();
    await this.prisma.friendship.deleteMany({
      where: { userAId: userAId!, userBId: userBId! },
    });
    return { ok: true };
  }

  async friendIds(meId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: meId }, { userBId: meId }] },
      select: { userAId: true, userBId: true },
    });
    return rows.map((r) => (r.userAId === meId ? r.userBId : r.userAId));
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    const [userAId, userBId] = [a, b].sort();
    const row = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId: userAId!, userBId: userBId! } },
    });
    return Boolean(row);
  }
}
