// Shared types used by both the NestJS backend and the Vue frontend.

export interface PublicUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  bio: string | null;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export type MessageType = "text" | "image" | "file" | "system";

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: MessageType;
  read: boolean;
  createdAt: string; // ISO string
}

export interface FriendRequestDTO {
  id: string;
  fromId: string;
  toId: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  from: PublicUser;
  to: PublicUser;
}

export interface Conversation {
  peer: PublicUser;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

// Socket.IO event names (single source of truth).
export const SocketEvents = {
  // client -> server
  SendMessage: "message:send",
  MarkRead: "message:read",
  Typing: "message:typing",
  // server -> client
  NewMessage: "message:new",
  MessageDelivered: "message:delivered",
  MessageRead: "message:read:ack",
  PeerTyping: "message:typing:peer",
  Presence: "presence:update",
} as const;

export interface SendMessagePayload {
  receiverId: string;
  content: string;
  type?: MessageType;
  clientId?: string; // optimistic id sent by client
}

export interface NewMessagePayload extends ChatMessage {
  clientId?: string;
}

export interface MarkReadPayload {
  peerId: string;
}

export interface TypingPayload {
  peerId: string;
  typing: boolean;
}

export interface PresencePayload {
  userId: string;
  online: boolean;
}
