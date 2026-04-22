import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type {
  Moment,
  MomentComment,
  MomentImage,
  MomentLike,
  User,
} from "@prisma/client";
import type {
  CreateMomentCommentPayload,
  CreateMomentPayload,
  MomentCommentDTO,
  MomentDTO,
  MomentImageDTO,
  PublicUser,
} from "@im/shared";
import { SocketEvents } from "@im/shared";
import { PrismaService } from "../prisma/prisma.service";
import { FriendsService } from "../friends/friends.service";
import { ChatGateway } from "../chat/chat.gateway";
import { toPublicUser } from "../users/user.mapper";

// Must match the whitelist on /upload — moments can only reference files
// served from our own /uploads/ directory (no arbitrary URLs).
const UPLOAD_URL_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;

type MomentFull = Moment & {
  author: User;
  images: MomentImage[];
  likes: (MomentLike & { user: User })[];
  comments: (MomentComment & { user: User; replyToUser: User | null })[];
};

@Injectable()
export class MomentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chat: ChatGateway,
  ) {}

  // ---- queries ----

  async feed(
    meId: string,
    take = 20,
    before?: string,
  ): Promise<MomentDTO[]> {
    let beforeDate: Date | undefined;
    if (before) {
      const d = new Date(before);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException("invalid 'before' date");
      }
      beforeDate = d;
    }

    const friendIds = await this.friends.friendIds(meId);
    // A user's own moments are always visible to themselves.
    const authorIds = [meId, ...friendIds];

    const rows = await this.prisma.moment.findMany({
      where: {
        deletedAt: null,
        authorId: { in: authorIds },
        ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
      },
      include: this.fullInclude(),
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(take, 1), 50),
    });

    return rows.map((r) => this.toDTO(r, meId));
  }

  async myMoments(
    meId: string,
    take = 20,
    before?: string,
  ): Promise<MomentDTO[]> {
    let beforeDate: Date | undefined;
    if (before) {
      const d = new Date(before);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException("invalid 'before' date");
      }
      beforeDate = d;
    }

    const rows = await this.prisma.moment.findMany({
      where: {
        deletedAt: null,
        authorId: meId,
        ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
      },
      include: this.fullInclude(),
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(take, 1), 50),
    });
    return rows.map((r) => this.toDTO(r, meId));
  }

  async userMoments(
    meId: string,
    authorId: string,
    take = 20,
    before?: string,
  ): Promise<MomentDTO[]> {
    if (authorId !== meId) {
      const ok = await this.friends.areFriends(meId, authorId);
      if (!ok) throw new ForbiddenException("not friends");
    }
    let beforeDate: Date | undefined;
    if (before) {
      const d = new Date(before);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException("invalid 'before' date");
      }
      beforeDate = d;
    }
    const rows = await this.prisma.moment.findMany({
      where: {
        deletedAt: null,
        authorId,
        ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
      },
      include: this.fullInclude(),
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(take, 1), 50),
    });
    return rows.map((r) => this.toDTO(r, meId));
  }

  async getById(meId: string, momentId: string): Promise<MomentDTO> {
    const m = await this.prisma.moment.findFirst({
      where: { id: momentId, deletedAt: null },
      include: this.fullInclude(),
    });
    if (!m) throw new NotFoundException("moment not found");
    await this.assertCanView(meId, m.authorId);
    return this.toDTO(m, meId);
  }

  // ---- mutations ----

  async create(
    authorId: string,
    payload: CreateMomentPayload,
  ): Promise<MomentDTO> {
    const content = (payload.content ?? "").trim();
    const imageUrls = (payload.imageUrls ?? []).filter(Boolean);
    if (!content && imageUrls.length === 0) {
      throw new BadRequestException("content or images required");
    }
    if (imageUrls.length > 9) {
      throw new BadRequestException("at most 9 images per moment");
    }
    for (const url of imageUrls) {
      if (!UPLOAD_URL_RE.test(url)) {
        throw new BadRequestException("invalid image url");
      }
    }

    const moment = await this.prisma.moment.create({
      data: {
        authorId,
        content,
        images: {
          create: imageUrls.map((url, idx) => ({ url, order: idx })),
        },
      },
      include: this.fullInclude(),
    });

    const dto = this.toDTO(moment, authorId);
    await this.broadcastToAudience(authorId, (uid) => {
      this.chat.emitToUser(uid, SocketEvents.MomentCreated, dto);
    });
    return dto;
  }

  async delete(meId: string, momentId: string): Promise<{ ok: true }> {
    const m = await this.prisma.moment.findUnique({
      where: { id: momentId },
      select: { id: true, authorId: true, deletedAt: true },
    });
    if (!m || m.deletedAt) throw new NotFoundException("moment not found");
    if (m.authorId !== meId) throw new ForbiddenException("not your moment");

    await this.prisma.moment.update({
      where: { id: momentId },
      data: { deletedAt: new Date() },
    });

    await this.broadcastToAudience(meId, (uid) => {
      this.chat.emitToUser(uid, SocketEvents.MomentDeleted, { momentId });
    });
    return { ok: true };
  }

  async like(meId: string, momentId: string): Promise<MomentDTO> {
    const m = await this.prisma.moment.findFirst({
      where: { id: momentId, deletedAt: null },
      select: { id: true, authorId: true },
    });
    if (!m) throw new NotFoundException("moment not found");
    await this.assertCanView(meId, m.authorId);

    // Idempotent upsert — liking twice is a no-op.
    await this.prisma.momentLike.upsert({
      where: { momentId_userId: { momentId, userId: meId } },
      create: { momentId, userId: meId },
      update: {},
    });

    const [user, likeCount, full] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: meId } }),
      this.prisma.momentLike.count({ where: { momentId } }),
      this.prisma.moment.findUniqueOrThrow({
        where: { id: momentId },
        include: this.fullInclude(),
      }),
    ]);

    await this.broadcastToAudience(m.authorId, (uid) => {
      this.chat.emitToUser(uid, SocketEvents.MomentLikeChanged, {
        momentId,
        liked: true,
        userId: meId,
        user: toPublicUser(user),
        likeCount,
      });
    });

    return this.toDTO(full, meId);
  }

  async unlike(meId: string, momentId: string): Promise<MomentDTO> {
    const m = await this.prisma.moment.findFirst({
      where: { id: momentId, deletedAt: null },
      select: { id: true, authorId: true },
    });
    if (!m) throw new NotFoundException("moment not found");
    await this.assertCanView(meId, m.authorId);

    await this.prisma.momentLike
      .delete({ where: { momentId_userId: { momentId, userId: meId } } })
      .catch(() => {
        // not liked yet — idempotent
      });

    const [user, likeCount, full] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: meId } }),
      this.prisma.momentLike.count({ where: { momentId } }),
      this.prisma.moment.findUniqueOrThrow({
        where: { id: momentId },
        include: this.fullInclude(),
      }),
    ]);

    await this.broadcastToAudience(m.authorId, (uid) => {
      this.chat.emitToUser(uid, SocketEvents.MomentLikeChanged, {
        momentId,
        liked: false,
        userId: meId,
        user: toPublicUser(user),
        likeCount,
      });
    });

    return this.toDTO(full, meId);
  }

  async addComment(
    meId: string,
    momentId: string,
    payload: CreateMomentCommentPayload,
  ): Promise<MomentCommentDTO> {
    const content = (payload.content ?? "").trim();
    if (!content) throw new BadRequestException("content required");

    const m = await this.prisma.moment.findFirst({
      where: { id: momentId, deletedAt: null },
      select: { id: true, authorId: true },
    });
    if (!m) throw new NotFoundException("moment not found");
    await this.assertCanView(meId, m.authorId);

    if (payload.replyToUserId) {
      // Sanity check: reply target must be a real user (don't leak whether the
      // user ever commented though — just checking existence is fine).
      const exists = await this.prisma.user.findUnique({
        where: { id: payload.replyToUserId },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestException("replyToUserId invalid");
      }
    }

    const comment = await this.prisma.momentComment.create({
      data: {
        momentId,
        userId: meId,
        content,
        replyToUserId: payload.replyToUserId ?? null,
      },
      include: { user: true, replyToUser: true },
    });

    const dto = this.toCommentDTO(comment);
    const commentCount = await this.prisma.momentComment.count({
      where: { momentId },
    });

    await this.broadcastToAudience(m.authorId, (uid) => {
      this.chat.emitToUser(uid, SocketEvents.MomentCommentAdded, {
        momentId,
        comment: dto,
        commentCount,
      });
    });

    return dto;
  }

  async deleteComment(
    meId: string,
    momentId: string,
    commentId: string,
  ): Promise<{ ok: true }> {
    const c = await this.prisma.momentComment.findUnique({
      where: { id: commentId },
      include: { moment: { select: { authorId: true, deletedAt: true } } },
    });
    if (!c || c.momentId !== momentId || c.moment.deletedAt) {
      throw new NotFoundException("comment not found");
    }
    // Comment author OR moment author may delete.
    if (c.userId !== meId && c.moment.authorId !== meId) {
      throw new ForbiddenException("cannot delete this comment");
    }

    await this.prisma.momentComment.delete({ where: { id: commentId } });
    const commentCount = await this.prisma.momentComment.count({
      where: { momentId },
    });

    await this.broadcastToAudience(c.moment.authorId, (uid) => {
      this.chat.emitToUser(uid, SocketEvents.MomentCommentDeleted, {
        momentId,
        commentId,
        commentCount,
      });
    });

    return { ok: true };
  }

  // ---- helpers ----

  private fullInclude() {
    return {
      author: true,
      images: { orderBy: { order: "asc" as const } },
      likes: {
        include: { user: true },
        orderBy: { createdAt: "asc" as const },
      },
      comments: {
        include: { user: true, replyToUser: true },
        orderBy: { createdAt: "asc" as const },
      },
    };
  }

  private async assertCanView(meId: string, authorId: string): Promise<void> {
    if (authorId === meId) return;
    const ok = await this.friends.areFriends(meId, authorId);
    if (!ok) throw new ForbiddenException("not friends");
  }

  // Push a moment event to the author and all their current friends (plus
  // the acting user, if different). Uses per-user rooms so multi-tab works.
  private async broadcastToAudience(
    authorId: string,
    emit: (userId: string) => void,
  ): Promise<void> {
    const friendIds = await this.friends.friendIds(authorId);
    const audience = new Set<string>([authorId, ...friendIds]);
    for (const uid of audience) emit(uid);
  }

  private toDTO(m: MomentFull, meId: string): MomentDTO {
    const likes: PublicUser[] = m.likes.map((l) => toPublicUser(l.user));
    const images: MomentImageDTO[] = m.images.map((i) => ({
      id: i.id,
      url: i.url,
      order: i.order,
    }));
    const comments = m.comments.map((c) => this.toCommentDTO(c));
    return {
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      author: toPublicUser(m.author),
      images,
      likes,
      likeCount: likes.length,
      likedByMe: m.likes.some((l) => l.userId === meId),
      comments,
      commentCount: comments.length,
    };
  }

  private toCommentDTO(
    c: MomentComment & { user: User; replyToUser: User | null },
  ): MomentCommentDTO {
    return {
      id: c.id,
      momentId: c.momentId,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      user: toPublicUser(c.user),
      replyToUser: c.replyToUser ? toPublicUser(c.replyToUser) : null,
    };
  }
}
