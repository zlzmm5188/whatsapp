import type { User } from "@prisma/client";
import type { PublicUser } from "@im/shared";

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    bio: user.bio,
  };
}
