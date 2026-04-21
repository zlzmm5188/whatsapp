import { defineStore } from "pinia";
import { api } from "../api/endpoints";
import { getSocket } from "../api/socket";
import type {
  ChatMessage,
  Conversation,
  GroupDetail,
  GroupSummary,
  MessageType,
  NewMessagePayload,
  PeerTypingPayload,
  PresencePayload,
  PublicUser,
  SendMessagePayload,
} from "@im/shared";
import { SocketEvents } from "@im/shared";

// A key used to store messages / typing state per chat target.
// `dm:<peerId>` for direct chats, `group:<groupId>` for group chats.
export type ChatKey = `dm:${string}` | `group:${string}`;

export function dmKey(peerId: string): ChatKey {
  return `dm:${peerId}`;
}
export function groupKey(groupId: string): ChatKey {
  return `group:${groupId}`;
}

interface SendArgs {
  content: string;
  type?: MessageType;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMime?: string;
}

interface State {
  conversations: Conversation[];
  friends: PublicUser[];
  groups: GroupSummary[];
  groupDetails: Record<string, GroupDetail>;
  messagesByKey: Record<string, ChatMessage[]>;
  // Tracks which ChatKeys have had their full history fetched. `messagesByKey`
  // alone can't answer this because `handleIncoming` may pre-populate a key
  // with a single socket-delivered message before the chat is ever opened.
  historyLoaded: Set<ChatKey>;
  onlineUsers: Set<string>;
  // For DMs typing keys are `dm:<peerId>`; for groups we store the typing
  // user id prefixed as `group:<groupId>:<userId>` so multiple users can type
  // simultaneously.
  typingKeys: Set<string>;
  activeKey: ChatKey | null;
  bound: boolean;
}

export const useChatStore = defineStore("chat", {
  state: (): State => ({
    conversations: [],
    friends: [],
    groups: [],
    groupDetails: {},
    messagesByKey: {},
    historyLoaded: new Set(),
    onlineUsers: new Set(),
    typingKeys: new Set(),
    activeKey: null,
    bound: false,
  }),
  getters: {
    messagesFor:
      (s) =>
      (key: ChatKey): ChatMessage[] =>
        s.messagesByKey[key] ?? [],
    isOnline:
      (s) =>
      (userId: string): boolean =>
        s.onlineUsers.has(userId),
    isDMTyping:
      (s) =>
      (peerId: string): boolean =>
        s.typingKeys.has(`dm:${peerId}`),
    groupTypingUserIds:
      (s) =>
      (groupId: string): string[] => {
        const prefix = `group:${groupId}:`;
        const out: string[] = [];
        for (const k of s.typingKeys) {
          if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
        }
        return out;
      },
    dmConversation:
      (s) =>
      (peerId: string): Conversation | undefined =>
        s.conversations.find((c) => c.kind === "dm" && c.peer?.id === peerId),
    groupConversation:
      (s) =>
      (groupId: string): Conversation | undefined =>
        s.conversations.find(
          (c) => c.kind === "group" && c.group?.id === groupId,
        ),
  },
  actions: {
    bindSocket() {
      if (this.bound) return;
      const socket = getSocket();
      if (!socket) return;

      socket.on(SocketEvents.NewMessage, (msg: NewMessagePayload) => {
        this.handleIncoming(msg);
      });
      socket.on(SocketEvents.MessageRead, ({ peerId }: { peerId: string }) => {
        // peerId = the user who just read our DMs to them
        const list = this.messagesByKey[dmKey(peerId)];
        if (!list) return;
        for (const m of list) {
          if (m.receiverId === peerId) m.read = true;
        }
      });
      socket.on(SocketEvents.PeerTyping, (p: PeerTypingPayload) => {
        const k = p.groupId
          ? `group:${p.groupId}:${p.peerId}`
          : `dm:${p.peerId}`;
        if (p.typing) this.typingKeys.add(k);
        else this.typingKeys.delete(k);
        // trigger reactivity
        this.typingKeys = new Set(this.typingKeys);
      });
      socket.on(SocketEvents.Presence, ({ userId, online }: PresencePayload) => {
        if (online) this.onlineUsers.add(userId);
        else this.onlineUsers.delete(userId);
        this.onlineUsers = new Set(this.onlineUsers);
      });
      socket.on(SocketEvents.GroupCreated, (detail: GroupDetail) => {
        this.groupDetails[detail.id] = detail;
        if (!this.groups.some((g) => g.id === detail.id)) {
          this.groups = [detail, ...this.groups];
        }
        // Refresh conversations so the new group shows up in the chat list.
        void this.refreshConversations();
      });
      socket.on(SocketEvents.GroupMembersChanged, (detail: GroupDetail) => {
        this.groupDetails[detail.id] = detail;
        // If I was removed, drop the group locally.
        const me = this.meId();
        if (me && !detail.members.some((m) => m.userId === me)) {
          this.groups = this.groups.filter((g) => g.id !== detail.id);
          this.conversations = this.conversations.filter(
            (c) => c.group?.id !== detail.id,
          );
          const key = groupKey(detail.id);
          delete this.messagesByKey[key];
          // Also drop the historyLoaded flag so that if the user is re-added
          // later, openGroup() will refetch history instead of short-
          // circuiting on the stale flag (messagesByKey was just deleted, so
          // the chat would otherwise render empty until a page refresh).
          this.historyLoaded.delete(key);
        }
      });

      this.bound = true;
    },

    async loadAll() {
      const [convs, fs, gs] = await Promise.all([
        api.conversations(),
        api.friends(),
        api.groups(),
      ]);
      this.conversations = convs;
      this.friends = fs;
      this.groups = gs;
    },

    async refreshConversations() {
      this.conversations = await api.conversations();
    },

    async refreshGroups() {
      this.groups = await api.groups();
    },

    async loadGroupDetail(groupId: string): Promise<GroupDetail> {
      const detail = await api.group(groupId);
      this.groupDetails[groupId] = detail;
      return detail;
    },

    async openDM(peerId: string) {
      const key = dmKey(peerId);
      this.activeKey = key;
      // Track history load separately from presence of messages:
      // `handleIncoming` can populate `messagesByKey[key]` with just a
      // socket-delivered message before the chat is ever opened, so the
      // mere existence of the key does NOT mean history has been fetched.
      if (!this.historyLoaded.has(key)) {
        const history = await api.historyDM(peerId, 50);
        // Messages pushed in by `handleIncoming` during the fetch must be
        // merged (dedup by id), not overwritten.
        const arrived: ChatMessage[] = this.messagesByKey[key] ?? [];
        const ids = new Set(history.map((m) => m.id));
        this.messagesByKey[key] = [
          ...history,
          ...arrived.filter((m) => !ids.has(m.id)),
        ];
        this.historyLoaded.add(key);
      }
      const meId = this.meId();
      const list = this.messagesByKey[key] ?? [];
      for (const m of list) {
        if (m.senderId === peerId && m.receiverId === meId && !m.read) {
          m.read = true;
        }
      }
      await api.markReadDM(peerId);
      const conv = this.dmConversation(peerId);
      if (conv) conv.unreadCount = 0;
      const socket = getSocket();
      socket?.emit(SocketEvents.MarkRead, { peerId });
    },

    async openGroup(groupId: string) {
      const key = groupKey(groupId);
      this.activeKey = key;
      // See openDM — gate on historyLoaded, not on presence of messages.
      if (!this.historyLoaded.has(key)) {
        const history = await api.historyGroup(groupId, 50);
        const arrived: ChatMessage[] = this.messagesByKey[key] ?? [];
        const ids = new Set(history.map((m) => m.id));
        this.messagesByKey[key] = [
          ...history,
          ...arrived.filter((m) => !ids.has(m.id)),
        ];
        this.historyLoaded.add(key);
      }
      if (!this.groupDetails[groupId]) {
        await this.loadGroupDetail(groupId);
      }
      await api.markReadGroup(groupId);
      const conv = this.groupConversation(groupId);
      if (conv) conv.unreadCount = 0;
      const socket = getSocket();
      socket?.emit(SocketEvents.MarkRead, { groupId });
    },

    closeChat() {
      this.activeKey = null;
    },

    sendDM(peerId: string, args: SendArgs) {
      const socket = getSocket();
      if (!socket) return;
      const clientId = `c_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const payload: SendMessagePayload = {
        receiverId: peerId,
        content: args.content,
        type: args.type ?? "text",
        mediaUrl: args.mediaUrl,
        mediaName: args.mediaName,
        mediaSize: args.mediaSize,
        mediaMime: args.mediaMime,
        clientId,
      };
      socket.emit(SocketEvents.SendMessage, payload);
    },

    sendGroup(groupId: string, args: SendArgs) {
      const socket = getSocket();
      if (!socket) return;
      const clientId = `c_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const payload: SendMessagePayload = {
        groupId,
        content: args.content,
        type: args.type ?? "text",
        mediaUrl: args.mediaUrl,
        mediaName: args.mediaName,
        mediaSize: args.mediaSize,
        mediaMime: args.mediaMime,
        clientId,
      };
      socket.emit(SocketEvents.SendMessage, payload);
    },

    sendTypingDM(peerId: string, typing: boolean) {
      const socket = getSocket();
      socket?.emit(SocketEvents.Typing, { peerId, typing });
    },
    sendTypingGroup(groupId: string, typing: boolean) {
      const socket = getSocket();
      socket?.emit(SocketEvents.Typing, { groupId, typing });
    },

    handleIncoming(msg: NewMessagePayload) {
      const meId = this.meId();
      let key: ChatKey;
      let isGroup = false;
      if (msg.groupId) {
        key = groupKey(msg.groupId);
        isGroup = true;
      } else if (msg.senderId === meId) {
        key = dmKey(msg.receiverId as string);
      } else {
        key = dmKey(msg.senderId);
      }

      const list = this.messagesByKey[key] ?? [];
      if (!list.some((m) => m.id === msg.id)) {
        list.push({
          id: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          groupId: msg.groupId,
          content: msg.content,
          type: msg.type,
          mediaUrl: msg.mediaUrl,
          mediaName: msg.mediaName,
          mediaSize: msg.mediaSize,
          mediaMime: msg.mediaMime,
          read: msg.read,
          createdAt: msg.createdAt,
        });
      }
      this.messagesByKey[key] = list;

      // Update matching conversation's lastMessage + unread count.
      let conv: Conversation | undefined;
      if (isGroup) {
        conv = this.groupConversation(msg.groupId as string);
      } else {
        const peerId = msg.senderId === meId ? msg.receiverId : msg.senderId;
        conv = this.dmConversation(peerId as string);
      }
      if (conv) {
        conv.lastMessage = { ...msg };
        const isMine = msg.senderId === meId;
        const isActive = this.activeKey === key;
        if (!isMine && !isActive) {
          conv.unreadCount += 1;
        }
        // resort
        this.conversations = [...this.conversations].sort((a, b) => {
          const ta = a.lastMessage ? Date.parse(a.lastMessage.createdAt) : 0;
          const tb = b.lastMessage ? Date.parse(b.lastMessage.createdAt) : 0;
          return tb - ta;
        });
      } else {
        // unknown target -> refresh conversations so it shows up
        void this.refreshConversations();
      }

      // if the chat is open and I'm not the sender, mark read immediately
      if (msg.senderId !== meId && this.activeKey === key) {
        const socket = getSocket();
        if (isGroup) {
          void api.markReadGroup(msg.groupId as string);
          socket?.emit(SocketEvents.MarkRead, { groupId: msg.groupId });
        } else {
          const peerId = msg.senderId;
          void api.markReadDM(peerId);
          socket?.emit(SocketEvents.MarkRead, { peerId });
        }
      }
    },

    meId(): string | null {
      try {
        const raw = localStorage.getItem("im_user");
        if (!raw) return null;
        return (JSON.parse(raw) as { id: string }).id;
      } catch {
        return null;
      }
    },

    reset() {
      this.conversations = [];
      this.friends = [];
      this.groups = [];
      this.groupDetails = {};
      this.messagesByKey = {};
      this.historyLoaded = new Set();
      this.onlineUsers = new Set();
      this.typingKeys = new Set();
      this.activeKey = null;
      this.bound = false;
    },
  },
});
