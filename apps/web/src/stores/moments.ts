import { defineStore } from "pinia";
import { api } from "../api/endpoints";
import { getSocket } from "../api/socket";
import type {
  MomentCommentAddedPayload,
  MomentCommentDeletedPayload,
  MomentDTO,
  MomentDeletedPayload,
  MomentLikeChangedPayload,
} from "@im/shared";
import { SocketEvents } from "@im/shared";

interface State {
  feed: MomentDTO[];
  byId: Record<string, MomentDTO>;
  loading: boolean;
  // whether we think there are older moments available via pagination
  hasMore: boolean;
  bound: boolean;
}

export const useMomentsStore = defineStore("moments", {
  state: (): State => ({
    feed: [],
    byId: {},
    loading: false,
    hasMore: true,
    bound: false,
  }),
  getters: {
    // Feed in rendering order; we rebuild this from `byId` so socket updates
    // reflect immediately without needing to re-fetch.
    timeline(s): MomentDTO[] {
      return s.feed
        .map((m) => s.byId[m.id])
        .filter((m): m is MomentDTO => !!m);
    },
  },
  actions: {
    bindSocket() {
      if (this.bound) return;
      const socket = getSocket();
      if (!socket) return;

      socket.on(SocketEvents.MomentCreated, (m: MomentDTO) => {
        this.upsert(m);
        if (!this.feed.some((x) => x.id === m.id)) {
          this.feed = [m, ...this.feed];
        }
      });
      socket.on(
        SocketEvents.MomentDeleted,
        ({ momentId }: MomentDeletedPayload) => {
          this.removeLocal(momentId);
        },
      );
      socket.on(
        SocketEvents.MomentLikeChanged,
        (p: MomentLikeChangedPayload) => {
          const m = this.byId[p.momentId];
          if (!m) return;
          const exists = m.likes.some((u) => u.id === p.userId);
          if (p.liked && !exists) m.likes = [...m.likes, p.user];
          if (!p.liked) m.likes = m.likes.filter((u) => u.id !== p.userId);
          m.likeCount = p.likeCount;
          // likedByMe updated only for the acting user's own session via REST
          // response; for others this value is irrelevant but keep consistent:
          const me = getMeId();
          if (me === p.userId) m.likedByMe = p.liked;
        },
      );
      socket.on(
        SocketEvents.MomentCommentAdded,
        (p: MomentCommentAddedPayload) => {
          const m = this.byId[p.momentId];
          if (!m) return;
          if (!m.comments.some((c) => c.id === p.comment.id)) {
            m.comments = [...m.comments, p.comment];
          }
          m.commentCount = p.commentCount;
        },
      );
      socket.on(
        SocketEvents.MomentCommentDeleted,
        (p: MomentCommentDeletedPayload) => {
          const m = this.byId[p.momentId];
          if (!m) return;
          m.comments = m.comments.filter((c) => c.id !== p.commentId);
          m.commentCount = p.commentCount;
        },
      );

      this.bound = true;
    },

    upsert(m: MomentDTO) {
      this.byId[m.id] = { ...this.byId[m.id], ...m };
    },

    removeLocal(momentId: string) {
      delete this.byId[momentId];
      this.feed = this.feed.filter((m) => m.id !== momentId);
    },

    async loadFeed(refresh = false) {
      if (this.loading) return;
      this.loading = true;
      try {
        const before = refresh
          ? undefined
          : this.feed.length > 0
            ? this.feed[this.feed.length - 1]?.createdAt
            : undefined;
        const rows = await api.momentsFeed(20, before);
        if (refresh) {
          this.feed = [];
          this.byId = {};
        }
        for (const m of rows) this.upsert(m);
        // Merge, dedupe by id, preserve newest-first order.
        const merged = new Map<string, MomentDTO>();
        for (const m of refresh ? [] : this.feed) merged.set(m.id, m);
        for (const m of rows) merged.set(m.id, m);
        this.feed = [...merged.values()].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        this.hasMore = rows.length >= 20;
      } finally {
        this.loading = false;
      }
    },

    async create(content: string, imageUrls: string[]): Promise<MomentDTO> {
      const m = await api.createMoment({ content, imageUrls });
      this.upsert(m);
      if (!this.feed.some((x) => x.id === m.id)) {
        this.feed = [m, ...this.feed];
      }
      return m;
    },

    async remove(momentId: string) {
      await api.deleteMoment(momentId);
      // rely on socket to remove for others; remove locally immediately
      this.removeLocal(momentId);
    },

    async toggleLike(momentId: string) {
      const cur = this.byId[momentId];
      if (!cur) return;
      // Optimistic: flip it
      const next = { ...cur };
      if (cur.likedByMe) {
        next.likedByMe = false;
        next.likeCount = Math.max(0, cur.likeCount - 1);
      } else {
        next.likedByMe = true;
        next.likeCount = cur.likeCount + 1;
      }
      this.byId[momentId] = next;
      try {
        const updated = cur.likedByMe
          ? await api.unlikeMoment(momentId)
          : await api.likeMoment(momentId);
        this.upsert(updated);
      } catch (e) {
        // Roll back optimistic update
        this.byId[momentId] = cur;
        throw e;
      }
    },

    async addComment(
      momentId: string,
      content: string,
      replyToUserId?: string,
    ) {
      const c = await api.commentMoment(momentId, { content, replyToUserId });
      const m = this.byId[momentId];
      if (m && !m.comments.some((x) => x.id === c.id)) {
        m.comments = [...m.comments, c];
        m.commentCount = (m.commentCount ?? 0) + 1;
      }
      return c;
    },

    async removeComment(momentId: string, commentId: string) {
      await api.deleteMomentComment(momentId, commentId);
      const m = this.byId[momentId];
      if (m) {
        m.comments = m.comments.filter((c) => c.id !== commentId);
        m.commentCount = Math.max(0, (m.commentCount ?? 1) - 1);
      }
    },

    reset() {
      this.feed = [];
      this.byId = {};
      this.hasMore = true;
      this.bound = false;
    },
  },
});

function getMeId(): string | null {
  try {
    const raw = localStorage.getItem("im_user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: string };
    return u.id ?? null;
  } catch {
    return null;
  }
}
