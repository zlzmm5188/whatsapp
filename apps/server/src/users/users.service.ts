import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "./user.mapper";
import type { PublicUser } from "@im/shared";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(meId: string, q: string): Promise<PublicUser[]> {
    const query = q.trim();
    if (!query) return [];

    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: meId } },
          {
            OR: [
              { username: { contains: query } },
              { nickname: { contains: query } },
            ],
          },
        ],
      },
      take: 20,
      orderBy: { username: "asc" },
    });
    return users.map(toPublicUser);
  }

  async updateProfile(
    userId: string,
    data: { nickname?: string; bio?: string; avatar?: string },
  ): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: data.nickname,
        bio: data.bio,
        avatar: data.avatar,
      },
    });
    return toPublicUser(user);
  }
}
