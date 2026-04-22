import { defineStore } from "pinia";
import { api } from "../api/endpoints";
import { connectSocket, disconnectSocket } from "../api/socket";
import type { AuthResponse, PublicUser } from "@im/shared";

interface State {
  user: PublicUser | null;
  token: string | null;
  hydrated: boolean;
}

export const useAuthStore = defineStore("auth", {
  state: (): State => ({
    user: null,
    token: null,
    hydrated: false,
  }),
  getters: {
    isAuthenticated: (s) => !!s.token && !!s.user,
  },
  actions: {
    async hydrate() {
      if (this.hydrated) return;
      const token = localStorage.getItem("im_token");
      const userRaw = localStorage.getItem("im_user");
      if (token && userRaw) {
        this.token = token;
        try {
          this.user = JSON.parse(userRaw) as PublicUser;
        } catch {
          this.user = null;
        }
        try {
          this.user = await api.me();
          localStorage.setItem("im_user", JSON.stringify(this.user));
          connectSocket(token);
        } catch {
          this.logout();
        }
      }
      this.hydrated = true;
    },
    applyAuth(resp: AuthResponse) {
      this.token = resp.token;
      this.user = resp.user;
      localStorage.setItem("im_token", resp.token);
      localStorage.setItem("im_user", JSON.stringify(resp.user));
      connectSocket(resp.token);
    },
    async login(username: string, password: string) {
      const resp = await api.login({ username, password });
      this.applyAuth(resp);
    },
    async register(payload: {
      username: string;
      nickname: string;
      password: string;
      email?: string;
    }) {
      const resp = await api.register(payload);
      this.applyAuth(resp);
    },
    async updateProfile(payload: {
      nickname?: string;
      bio?: string | null;
      avatar?: string | null;
    }) {
      const user = await api.updateMe(payload);
      this.user = user;
      localStorage.setItem("im_user", JSON.stringify(user));
    },
    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem("im_token");
      localStorage.removeItem("im_user");
      disconnectSocket();
    },
  },
});
