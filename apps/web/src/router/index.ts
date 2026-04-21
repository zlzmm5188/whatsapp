import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
} from "vue-router";
import { useAuthStore } from "../stores/auth";

const Login = () => import("../pages/Login.vue");
const Register = () => import("../pages/Register.vue");
const AppShell = () => import("../pages/AppShell.vue");
const Chats = () => import("../pages/Chats.vue");
const ChatWindow = () => import("../pages/ChatWindow.vue");
const GroupChatWindow = () => import("../pages/GroupChatWindow.vue");
const Contacts = () => import("../pages/Contacts.vue");
const Profile = () => import("../pages/Profile.vue");
const EmptyChat = () => import("../pages/EmptyChat.vue");
const Moments = () => import("../pages/Moments.vue");

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: Login, meta: { guest: true } },
    {
      path: "/register",
      name: "register",
      component: Register,
      meta: { guest: true },
    },
    {
      path: "/",
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "chats",
          component: Chats,
          children: [
            { path: "", name: "chats-empty", component: EmptyChat },
            {
              path: "c/:peerId",
              name: "chat",
              component: ChatWindow,
              props: true,
            },
            {
              path: "g/:groupId",
              name: "group-chat",
              component: GroupChatWindow,
              props: true,
            },
          ],
        },
        { path: "contacts", name: "contacts", component: Contacts },
        { path: "moments", name: "moments", component: Moments },
        { path: "me", name: "profile", component: Profile },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async (to: RouteLocationNormalized) => {
  const auth = useAuthStore();
  if (!auth.hydrated) await auth.hydrate();
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: "login", query: { next: to.fullPath } };
  }
  if (to.meta.guest && auth.isAuthenticated) {
    return { name: "chats" };
  }
  return true;
});
