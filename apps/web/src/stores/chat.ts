import { defineStore } from "pinia";
import { api } from "../api/endpoints";
import { getSocket } from "../api/socket";
import type {
  ChatMessage,
  Conversation,
  NewMessagePayload,
  PresencePayload,
  PublicUser,
  SendMessagePayload,
} from "@im/shared";
import { SocketEvents } from "@im/shared";

interface State {
  conversations: Conversation[];
  friends: PublicUser[];
  messagesByPeer: Record<string, ChatMessage[]>;
  onlineUsers: Set<string>;
  typingPeers: Set<string>;
  activePeerId: string | null;
  bound: boolean;
}

export const useChatStore = defineStore("chat", {
  state: (): State => ({
    conversations: [],
    friends: [],
    messagesByPeer: {},
    onlineUsers: new Set(),
    typingPeers: new Set(),
    activePeerId: null,
    bound: false,
  }),
  getters: {
    conversationFor:
      (s) =>
      (peerId: string): Conversation | undefined =>
        s.conversations.find((c) => c.peer.id === peerId),
    messagesFor:
      (s) =>
      (peerId: string): ChatMessage[] =>
        s.messagesByPeer[peerId] ?? [],
    isOnline:
      (s) =>
      (userId: string): boolean =>
        s.onlineUsers.has(userId),
    isTyping:
      (s) =>
      (peerId: string): boolean =>
        s.typingPeers.has(peerId),
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
        // peerId = the user who just read our messages to them
        const list = this.messagesByPeer[peerId];
        if (!list) return;
        for (const m of list) {
          if (m.receiverId === peerId) m.read = true;
        }
      });
      socket.on(
        SocketEvents.PeerTyping,
        ({ peerId, typing }: { peerId: string; typing: boolean }) => {
          if (typing) this.typingPeers.add(peerId);
          else this.typingPeers.delete(peerId);
          // trigger reactivity
          this.typingPeers = new Set(this.typingPeers);
        },
      );
      socket.on(SocketEvents.Presence, ({ userId, online }: PresencePayload) => {
        if (online) this.onlineUsers.add(userId);
        else this.onlineUsers.delete(userId);
        this.onlineUsers = new Set(this.onlineUsers);
      });

      this.bound = true;
    },

    async loadAll() {
      const [convs, fs] = await Promise.all([
        api.conversations(),
        api.friends(),
      ]);
      this.conversations = convs;
      this.friends = fs;
    },

    async refreshConversations() {
      this.conversations = await api.conversations();
    },

    async openChat(peerId: string) {
      this.activePeerId = peerId;
      if (!this.messagesByPeer[peerId]) {
        this.messagesByPeer[peerId] = await api.history(peerId, 50);
      }
      // mark read locally and on server
      const list = this.messagesByPeer[peerId] ?? [];
      for (const m of list) {
        if (m.receiverId !== peerId) continue;
      }
      await api.markRead(peerId);
      const conv = this.conversations.find((c) => c.peer.id === peerId);
      if (conv) conv.unreadCount = 0;
      // notify via socket so sender sees "read"
      const socket = getSocket();
      socket?.emit(SocketEvents.MarkRead, { peerId });
    },

    closeChat() {
      this.activePeerId = null;
    },

    sendText(peerId: string, content: string) {
      const socket = getSocket();
      if (!socket) return;
      const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const payload: SendMessagePayload = {
        receiverId: peerId,
        content,
        type: "text",
        clientId,
      };
      socket.emit(SocketEvents.SendMessage, payload);
    },

    sendTyping(peerId: string, typing: boolean) {
      const socket = getSocket();
      socket?.emit(SocketEvents.Typing, { peerId, typing });
    },

    handleIncoming(msg: NewMessagePayload) {
      const meId = this.meId();
      const peerId = msg.senderId === meId ? msg.receiverId : msg.senderId;
      const list = this.messagesByPeer[peerId] ?? [];
      if (!list.some((m) => m.id === msg.id)) {
        list.push({
          id: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          content: msg.content,
          type: msg.type,
          read: msg.read,
          createdAt: msg.createdAt,
        });
      }
      this.messagesByPeer[peerId] = list;

      // update conversation preview / unread
      const conv = this.conversations.find((c) => c.peer.id === peerId);
      if (conv) {
        conv.lastMessage = {
          id: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          content: msg.content,
          type: msg.type,
          read: msg.read,
          createdAt: msg.createdAt,
        };
        if (msg.senderId !== meId && this.activePeerId !== peerId) {
          conv.unreadCount += 1;
        }
        // resort
        this.conversations = [
          ...this.conversations.filter((c) => c.peer.id !== peerId),
          conv,
        ].sort((a, b) => {
          const ta = a.lastMessage ? Date.parse(a.lastMessage.createdAt) : 0;
          const tb = b.lastMessage ? Date.parse(b.lastMessage.createdAt) : 0;
          return tb - ta;
        });
      } else {
        // unknown peer -> refresh conversations so it shows up
        void this.refreshConversations();
      }

      // if the chat is open and I'm the receiver, mark read immediately
      if (msg.senderId !== meId && this.activePeerId === peerId) {
        void api.markRead(peerId);
        const socket = getSocket();
        socket?.emit(SocketEvents.MarkRead, { peerId });
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
      this.messagesByPeer = {};
      this.onlineUsers = new Set();
      this.typingPeers = new Set();
      this.activePeerId = null;
      this.bound = false;
    },
  },
});
