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

export type MessageType = "text" | "image" | "file" | "emoji" | "system";

export interface ChatMessage {
  id: string;
  senderId: string;
  // Either receiverId (DM) or groupId (group chat) will be set.
  receiverId: string | null;
  groupId: string | null;
  content: string;
  type: MessageType;
  mediaUrl: string | null;
  mediaName: string | null;
  mediaSize: number | null;
  mediaMime: string | null;
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

// A chat conversation: either DM (peer set) or group (group set).
export interface Conversation {
  kind: "dm" | "group";
  peer: PublicUser | null;
  group: GroupSummary | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

export interface GroupSummary {
  id: string;
  name: string;
  avatar: string | null;
  description: string | null;
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMemberDTO[];
}

export interface GroupMemberDTO {
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  user: PublicUser;
}

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  mime: string;
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
  // group events (server -> client)
  GroupCreated: "group:created",
  GroupMembersChanged: "group:members:changed",
} as const;

export interface SendMessagePayload {
  // Exactly one of `receiverId` or `groupId` must be set.
  receiverId?: string;
  groupId?: string;
  content: string;
  type?: MessageType;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMime?: string;
  clientId?: string; // optimistic id sent by client
}

export interface NewMessagePayload extends ChatMessage {
  clientId?: string;
}

export interface MarkReadPayload {
  peerId?: string;
  groupId?: string;
}

export interface TypingPayload {
  peerId?: string;
  groupId?: string;
  typing: boolean;
}

export interface PresencePayload {
  userId: string;
  online: boolean;
}

export interface PeerTypingPayload {
  // who is typing
  peerId: string;
  // scope: either dm (peerId already identifies the DM peer)
  // or group (groupId is set so ChatWindow can filter)
  groupId?: string;
  typing: boolean;
}
