import { http } from "./http";
import type {
  AuthResponse,
  ChatMessage,
  Conversation,
  FriendRequestDTO,
  PublicUser,
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
  async history(
    peerId: string,
    take = 50,
    before?: string,
  ): Promise<ChatMessage[]> {
    const { data } = await http.get<ChatMessage[]>(`/messages/${peerId}`, {
      params: { take, before },
    });
    return data;
  },
  async markRead(peerId: string): Promise<{ updated: number }> {
    const { data } = await http.post<{ updated: number }>(
      `/messages/${peerId}/read`,
    );
    return data;
  },
};
