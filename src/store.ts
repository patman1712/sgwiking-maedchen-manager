import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AppSettings,
  Conversation,
  Message,
  Team,
  UserProfile,
  UserRole,
} from "@/types";

interface TeamInput {
  name: string;
  ageGroup: string;
  season: string;
  trainingDay: string;
  location: string;
  notes: string;
}

interface UserInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  teamIds: string[];
  notes: string;
}

interface ApiStatePayload {
  teams: Team[];
  users: UserProfile[];
  conversations: Conversation[];
  messages: Message[];
  settings: AppSettings;
  currentUser?: UserProfile | null;
}

interface ActionResult {
  success: boolean;
  error?: string;
}

interface AppState {
  teams: Team[];
  users: UserProfile[];
  conversations: Conversation[];
  messages: Message[];
  settings: AppSettings;
  currentUserId: string | null;
  loading: boolean;
  initialized: boolean;
  fetchData: () => Promise<void>;
  login: (email: string, password: string) => Promise<ActionResult>;
  logout: () => void;
  addTeam: (input: TeamInput) => Promise<ActionResult>;
  updateTeam: (teamId: string, input: TeamInput) => Promise<ActionResult>;
  addUser: (input: UserInput) => Promise<ActionResult>;
  setTeamMembership: (
    teamId: string,
    trainerIds: string[],
    playerIds: string[],
  ) => Promise<ActionResult>;
  ensureTeamConversation: (teamId: string) => Promise<string | null>;
  ensureDirectConversation: (otherUserId: string) => Promise<string | null>;
  sendMessage: (conversationId: string, content: string) => Promise<ActionResult>;
}

export const initialAppState = {
  teams: [] as Team[],
  users: [] as UserProfile[],
  conversations: [] as Conversation[],
  messages: [] as Message[],
  settings: {
    clubName: "SG Wiking Offenbach",
    logoUrl: null,
  } as AppSettings,
  currentUserId: null as string | null,
  loading: false,
  initialized: false,
};

const memoryStorage = {
  data: new Map<string, string>(),
  getItem: (name: string) => memoryStorage.data.get(name) ?? null,
  setItem: (name: string, value: string) => {
    memoryStorage.data.set(name, value);
  },
  removeItem: (name: string) => {
    memoryStorage.data.delete(name);
  },
};

const storage = createJSONStorage(() =>
  typeof window === "undefined" ? memoryStorage : window.localStorage,
);

const applyPayload = (
  set: (partial: Partial<AppState>) => void,
  payload: ApiStatePayload,
  fallbackUserId: string | null,
) => {
  set({
    teams: payload.teams,
    users: payload.users,
    conversations: payload.conversations,
    messages: payload.messages,
    settings: payload.settings,
    currentUserId: payload.currentUser?.id ?? fallbackUserId,
    initialized: true,
  });
};

const readJson = async (response: Response) => {
  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Die Anfrage konnte nicht verarbeitet werden.");
  }

  return data;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialAppState,
      fetchData: async () => {
        set({ loading: true });

        try {
          const currentUserId = get().currentUserId;
          const query = currentUserId
            ? `?userId=${encodeURIComponent(currentUserId)}`
            : "";
          const response = await fetch(`/api/bootstrap${query}`);
          const data = (await readJson(response)) as ApiStatePayload;

          applyPayload(set, data, get().currentUserId);
        } finally {
          set({ loading: false, initialized: true });
        }
      },
      login: async (email, password) => {
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await readJson(response);
          const currentUserId = data.user.id as string;

          set({ currentUserId });
          await get().fetchData();

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Anmeldung fehlgeschlagen.",
          };
        }
      },
      logout: () =>
        set({
          currentUserId: null,
          initialized: true,
        }),
      addTeam: async (input) => {
        try {
          const response = await fetch("/api/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, get().currentUserId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Team konnte nicht angelegt werden.",
          };
        }
      },
      updateTeam: async (teamId, input) => {
        try {
          const response = await fetch(`/api/teams/${teamId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, get().currentUserId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Team konnte nicht gespeichert werden.",
          };
        }
      },
      addUser: async (input) => {
        try {
          const response = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, get().currentUserId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Person konnte nicht gespeichert werden.",
          };
        }
      },
      setTeamMembership: async (teamId, trainerIds, playerIds) => {
        try {
          const response = await fetch(`/api/teams/${teamId}/members`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trainerIds, playerIds }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, get().currentUserId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Zuweisungen konnten nicht gespeichert werden.",
          };
        }
      },
      ensureTeamConversation: async (teamId) => {
        try {
          const response = await fetch("/api/conversations/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId }),
          });
          const data = (await readJson(response)) as ApiStatePayload & {
            conversationId: string;
          };
          applyPayload(set, data, get().currentUserId);

          return data.conversationId;
        } catch {
          return null;
        }
      },
      ensureDirectConversation: async (otherUserId) => {
        const currentUserId = get().currentUserId;

        if (!currentUserId || currentUserId === otherUserId) {
          return null;
        }

        try {
          const response = await fetch("/api/conversations/direct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentUserId, otherUserId }),
          });
          const data = (await readJson(response)) as ApiStatePayload & {
            conversationId: string;
          };
          applyPayload(set, data, currentUserId);

          return data.conversationId;
        } catch {
          return null;
        }
      },
      sendMessage: async (conversationId, content) => {
        try {
          const senderId = get().currentUserId;

          if (!senderId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId, senderId, content }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, senderId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Nachricht konnte nicht gesendet werden.",
          };
        }
      },
    }),
    {
      name: "wiking-vereinsmanager-store",
      storage,
      partialize: (state) => ({ currentUserId: state.currentUserId }),
    },
  ),
);
