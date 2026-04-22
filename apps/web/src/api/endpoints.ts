import { http } from "./http";
import type {
  AuthResponse,
  ChatMessage,
  Conversation,
  CreateMomentCommentPayload,
  CreateMomentPayload,
  FriendRequestDTO,
  GroupDetail,
  GroupSummary,
  MomentCommentDTO,
  MomentDTO,
  PublicUser,
  UploadedFile,
} from "@im/shared";

export const api = {
  async register(payload: {
    username: string;
    nickname: string;
    password: string;
    email?: string;
  }): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>("/auth/register", payload);
    return data;
  },
  async login(payload: {
    username: string;
    password: string;
  }): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>("/auth/login", payload);
    return data;
  },
  async me(): Promise<PublicUser> {
    const { data } = await http.get<PublicUser>("/auth/me");
    return data;
  },
  async updateMe(payload: {
    nickname?: string;
    bio?: string | null;
    avatar?: string | null;
  }): Promise<PublicUser> {
    const { data } = await http.patch<PublicUser>("/users/me", payload);
    return data;
  },
  async searchUsers(q: string): Promise<PublicUser[]> {
    const { data } = await http.get<PublicUser[]>("/users/search", {
      params: { q },
    });
    return data;
  },
  async friends(): Promise<PublicUser[]> {
    const { data } = await http.get<PublicUser[]>("/friends");
    return data;
  },
  async friendRequests(): Promise<FriendRequestDTO[]> {
    const { data } = await http.get<FriendRequestDTO[]>("/friends/requests");
    return data;
  },
  async sendFriendRequest(payload: {
    toUsername: string;
    message?: string;
  }): Promise<FriendRequestDTO> {
    const { data } = await http.post<FriendRequestDTO>(
      "/friends/requests",
      payload,
    );
    return data;
  },
  async acceptFriendRequest(id: string): Promise<PublicUser> {
    const { data } = await http.post<PublicUser>(
      `/friends/requests/${id}/accept`,
    );
    return data;
  },
  async rejectFriendRequest(id: string): Promise<{ ok: true }> {
    const { data } = await http.post<{ ok: true }>(
      `/friends/requests/${id}/reject`,
    );
    return data;
  },
  async conversations(): Promise<Conversation[]> {
    const { data } = await http.get<Conversation[]>("/messages/conversations");
    return data;
  },
  async historyDM(
    peerId: string,
    take = 50,
    before?: string,
  ): Promise<ChatMessage[]> {
    const { data } = await http.get<ChatMessage[]>(`/messages/dm/${peerId}`, {
      params: { take, before },
    });
    return data;
  },
  async historyGroup(
    groupId: string,
    take = 50,
    before?: string,
  ): Promise<ChatMessage[]> {
    const { data } = await http.get<ChatMessage[]>(
      `/messages/group/${groupId}`,
      { params: { take, before } },
    );
    return data;
  },
  async markReadDM(peerId: string): Promise<{ updated: number }> {
    const { data } = await http.post<{ updated: number }>(
      `/messages/dm/${peerId}/read`,
    );
    return data;
  },
  async markReadGroup(groupId: string): Promise<{ updated: number }> {
    const { data } = await http.post<{ updated: number }>(
      `/messages/group/${groupId}/read`,
    );
    return data;
  },

  async groups(): Promise<GroupSummary[]> {
    const { data } = await http.get<GroupSummary[]>("/groups");
    return data;
  },
  async group(id: string): Promise<GroupDetail> {
    const { data } = await http.get<GroupDetail>(`/groups/${id}`);
    return data;
  },
  async createGroup(payload: {
    name: string;
    memberIds: string[];
    description?: string;
    avatar?: string;
  }): Promise<GroupDetail> {
    const { data } = await http.post<GroupDetail>("/groups", payload);
    return data;
  },
  async addGroupMembers(
    groupId: string,
    memberIds: string[],
  ): Promise<GroupDetail> {
    const { data } = await http.post<GroupDetail>(
      `/groups/${groupId}/members`,
      { memberIds },
    );
    return data;
  },
  async leaveGroup(groupId: string): Promise<GroupDetail> {
    const { data } = await http.delete<GroupDetail>(
      `/groups/${groupId}/leave`,
    );
    return data;
  },
  async removeGroupMember(
    groupId: string,
    userId: string,
  ): Promise<GroupDetail> {
    const { data } = await http.delete<GroupDetail>(
      `/groups/${groupId}/members/${userId}`,
    );
    return data;
  },

  async upload(file: File): Promise<UploadedFile> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await http.post<UploadedFile>("/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  // ----- Moments (朋友圈) -----
  async momentsFeed(take = 20, before?: string): Promise<MomentDTO[]> {
    const { data } = await http.get<MomentDTO[]>("/moments", {
      params: { take, before },
    });
    return data;
  },
  async myMoments(take = 20, before?: string): Promise<MomentDTO[]> {
    const { data } = await http.get<MomentDTO[]>("/moments/mine", {
      params: { take, before },
    });
    return data;
  },
  async userMoments(
    userId: string,
    take = 20,
    before?: string,
  ): Promise<MomentDTO[]> {
    const { data } = await http.get<MomentDTO[]>(`/moments/user/${userId}`, {
      params: { take, before },
    });
    return data;
  },
  async getMoment(id: string): Promise<MomentDTO> {
    const { data } = await http.get<MomentDTO>(`/moments/${id}`);
    return data;
  },
  async createMoment(payload: CreateMomentPayload): Promise<MomentDTO> {
    const { data } = await http.post<MomentDTO>("/moments", payload);
    return data;
  },
  async deleteMoment(id: string): Promise<{ ok: true }> {
    const { data } = await http.delete<{ ok: true }>(`/moments/${id}`);
    return data;
  },
  async likeMoment(id: string): Promise<MomentDTO> {
    const { data } = await http.post<MomentDTO>(`/moments/${id}/like`);
    return data;
  },
  async unlikeMoment(id: string): Promise<MomentDTO> {
    const { data } = await http.delete<MomentDTO>(`/moments/${id}/like`);
    return data;
  },
  async commentMoment(
    id: string,
    payload: CreateMomentCommentPayload,
  ): Promise<MomentCommentDTO> {
    const { data } = await http.post<MomentCommentDTO>(
      `/moments/${id}/comments`,
      payload,
    );
    return data;
  },
  async deleteMomentComment(
    id: string,
    commentId: string,
  ): Promise<{ ok: true }> {
    const { data } = await http.delete<{ ok: true }>(
      `/moments/${id}/comments/${commentId}`,
    );
    return data;
  },
};
