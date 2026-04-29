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
  // Optional client-side optimistic-UI fields. The server never sets these;
  // the web client populates them while a message is in flight so the bubble
  // can render immediately and reconcile on ack.
  clientId?: string;
  status?: "pending" | "sent" | "failed";
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
  // moment events (server -> client)
  MomentCreated: "moment:created",
  MomentDeleted: "moment:deleted",
  MomentLikeChanged: "moment:like:changed",
  MomentCommentAdded: "moment:comment:added",
  MomentCommentDeleted: "moment:comment:deleted",
  // call signaling (1:1 audio/video). The server is a dumb relay between
  // two friends — it does not store SDP/ICE; it just forwards.
  CallInvite: "call:invite", // client -> server, server -> callee
  CallAccept: "call:accept", // callee -> server -> caller
  CallReject: "call:reject", // callee -> server -> caller
  CallCancel: "call:cancel", // caller -> server -> callee (caller hung up before accept)
  CallEnd: "call:end", // either side -> server -> peer (in-call hangup)
  CallSdp: "call:sdp", // forward offer/answer SDP between peers
  CallIce: "call:ice", // forward ICE candidates between peers
  CallBusy: "call:busy", // server -> caller when callee is in another call
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

// ---------------- Moments (朋友圈) ----------------

export interface MomentImageDTO {
  id: string;
  url: string;
  order: number;
}

export interface MomentCommentDTO {
  id: string;
  momentId: string;
  content: string;
  createdAt: string;
  user: PublicUser;
  replyToUser: PublicUser | null;
}

export interface MomentDTO {
  id: string;
  content: string;
  createdAt: string;
  author: PublicUser;
  images: MomentImageDTO[];
  likes: PublicUser[]; // users who liked it
  likeCount: number;
  likedByMe: boolean;
  comments: MomentCommentDTO[];
  commentCount: number;
}

export interface CreateMomentPayload {
  content: string;
  imageUrls?: string[]; // paths under /uploads/*
}

export interface CreateMomentCommentPayload {
  content: string;
  replyToUserId?: string;
}

export interface MomentLikeChangedPayload {
  momentId: string;
  liked: boolean;
  userId: string;
  user: PublicUser;
  likeCount: number;
}

export interface MomentCommentAddedPayload {
  momentId: string;
  comment: MomentCommentDTO;
  commentCount: number;
}

export interface MomentCommentDeletedPayload {
  momentId: string;
  commentId: string;
  commentCount: number;
}

export interface MomentDeletedPayload {
  momentId: string;
}

// ---------------- Calls (1:1 audio/video) ----------------

export type CallKind = "audio" | "video";

// Client -> server: caller initiates a call.
export interface CallInvitePayload {
  callId: string;
  peerId: string; // callee user id
  kind: CallKind;
}

// Server -> callee: incoming call (server enriches with caller PublicUser).
export interface IncomingCallPayload {
  callId: string;
  fromUser: PublicUser;
  kind: CallKind;
}

// Either side -> server, then forwarded to the other peer.
export interface CallAcceptPayload {
  callId: string;
  peerId: string;
}
export interface CallRejectPayload {
  callId: string;
  peerId: string;
  reason?: "declined" | "busy" | "timeout";
}
export interface CallCancelPayload {
  callId: string;
  peerId: string;
}
export interface CallEndPayload {
  callId: string;
  peerId: string;
}

// SDP and ICE forwarding. The server does not parse — just relays. We use
// structural types here instead of the DOM `RTCSessionDescriptionInit` /
// `RTCIceCandidateInit` so this package can compile without DOM lib.
export interface SdpDescription {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}
export interface IceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}
export interface CallSdpPayload {
  callId: string;
  peerId: string;
  sdp: SdpDescription;
}
export interface CallIcePayload {
  callId: string;
  peerId: string;
  candidate: IceCandidate;
}

// Server -> caller when callee already has a call in progress.
export interface CallBusyPayload {
  callId: string;
  peerId: string; // the one who is busy
}
