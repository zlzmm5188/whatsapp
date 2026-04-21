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

    // Look up any prior request in either direction, regardless of status.
    // The @@unique([fromId, toId]) constraint means we must update-in-place
    // instead of creating a new row if one already exists.
    const existing = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromId: meId, toId: target.id },
          { fromId: target.id, toId: meId },
        ],
      },
    });
    if (existing && existing.status === "pending") {
      throw new ConflictException("request already pending");
    }

    const mineToThem =
      existing && existing.fromId === meId && existing.toId === target.id
        ? existing
        : null;

    const req = mineToThem
      ? await this.prisma.friendRequest.update({
          where: { id: mineToThem.id },
          data: { status: "pending", message: message ?? null },
          include: { from: true, to: true },
        })
      : await this.prisma.friendRequest.create({
          data: {
            fromId: meId,
            toId: target.id,
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

  async areFriends(a: string, b: string): Promise<boolean> {
    const [userAId, userBId] = [a, b].sort();
    const row = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId: userAId!, userBId: userBId! } },
    });
    return Boolean(row);
  }
}
