import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AppSettings,
  Conversation,
  InventoryItem,
  Match,
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
  fussballDeTeamId?: string;
}

interface UserInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  teamIds: string[];
  notes: string;
  memberNumber?: string;
  birthday?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  isMember?: boolean;
  hasMembershipApplication?: boolean;
  hasMedicalCertificate?: boolean;
  hasPhotoConsentSocial?: boolean;
}

interface ApiStatePayload {
  teams: Team[];
  users: UserProfile[];
  matches: Match[];
  inventoryItems: InventoryItem[];
  conversations: Conversation[];
  messages: Message[];
  settings: AppSettings;
  currentUser?: UserProfile | null;
}

interface ActionResult {
  success: boolean;
  error?: string;
}

interface UserUpdateInput {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  password?: string;
  role?: UserRole;
  teamIds?: string[];
  memberNumber?: string;
  birthday?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  isMember?: boolean;
  hasMembershipApplication?: boolean;
  hasMedicalCertificate?: boolean;
  hasPhotoConsentSocial?: boolean;
}

interface AppState {
  teams: Team[];
  users: UserProfile[];
  matches: Match[];
  inventoryItems: InventoryItem[];
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
  uploadTeamPhoto: (teamId: string, file: File) => Promise<ActionResult>;
  importTeamMatchesFromFussballDe: (teamId: string) => Promise<ActionResult & { importedCount?: number }>;
  deleteTeamMatchesBySeason: (
    teamId: string,
    season: string,
  ) => Promise<ActionResult & { deletedCount?: number }>;
  addInventoryItem: (input: {
    teamId: string;
    category: string;
    name: string;
    quantity: number;
    productInfo: string;
    notes: string;
    condition: string;
    imageFile?: File | null;
  }) => Promise<ActionResult>;
  deleteInventoryItem: (itemId: string) => Promise<ActionResult>;
  addUser: (input: UserInput) => Promise<ActionResult>;
  updateUser: (input: UserUpdateInput) => Promise<ActionResult>;
  deleteUser: (userId: string) => Promise<ActionResult>;
  uploadUserAvatar: (userId: string, file: File) => Promise<ActionResult>;
  addMatch: (input: {
    teamId: string;
    opponent: string;
    kickoffAt: string;
    location: string;
    isHome: boolean;
    result?: string;
  }) => Promise<ActionResult>;
  updateMatch: (matchId: string, input: Partial<{
    opponent: string;
    kickoffAt: string;
    location: string;
    isHome: boolean;
    result: string;
  }>) => Promise<ActionResult>;
  deleteMatch: (matchId: string) => Promise<ActionResult>;
  updateCurrentUser: (input: {
    fullName: string;
    email: string;
    phone: string;
    notes: string;
    password?: string;
  }) => Promise<ActionResult>;
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
  matches: [] as Match[],
  inventoryItems: [] as InventoryItem[],
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
    matches: payload.matches,
    inventoryItems: payload.inventoryItems,
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
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch("/api/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...input, actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

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
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch(`/api/teams/${teamId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...input, actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

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
      uploadTeamPhoto: async (teamId, file) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const payload = new FormData();
          payload.append("photo", file);
          payload.append("actorId", actorId);

          const response = await fetch(`/api/teams/${teamId}/photo`, {
            method: "POST",
            body: payload,
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Mannschaftsfoto konnte nicht gespeichert werden.",
          };
        }
      },
      importTeamMatchesFromFussballDe: async (teamId) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch(`/api/teams/${teamId}/import-fussballde`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload & {
            importedCount?: number;
          };
          applyPayload(set, data, actorId);

          return { success: true, importedCount: data.importedCount ?? 0 };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Spielplan konnte nicht importiert werden.",
          };
        }
      },
      deleteTeamMatchesBySeason: async (teamId, season) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch(`/api/teams/${teamId}/matches-season`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId, season }),
          });
          const data = (await readJson(response)) as ApiStatePayload & {
            deletedCount?: number;
          };
          applyPayload(set, data, actorId);

          return { success: true, deletedCount: data.deletedCount ?? 0 };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Saisondaten konnten nicht geloescht werden.",
          };
        }
      },
      addInventoryItem: async (input) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const payload = new FormData();
          payload.append("actorId", actorId);
          payload.append("teamId", input.teamId);
          payload.append("category", input.category);
          payload.append("name", input.name);
          payload.append("quantity", String(input.quantity));
          payload.append("productInfo", input.productInfo);
          payload.append("notes", input.notes);
          payload.append("condition", input.condition);

          if (input.imageFile) {
            payload.append("image", input.imageFile);
          }

          const response = await fetch("/api/inventory", {
            method: "POST",
            body: payload,
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Inventar konnte nicht gespeichert werden.",
          };
        }
      },
      deleteInventoryItem: async (itemId) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch(`/api/inventory/${itemId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Inventar konnte nicht geloescht werden.",
          };
        }
      },
      addUser: async (input) => {
        try {
          const actorId = get().currentUserId;
          const response = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...input, actorId }),
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
      updateUser: async (input) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const { userId, ...payload } = input;
          const response = await fetch(`/api/users/${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

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
      deleteUser: async (userId) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch(`/api/users/${userId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Person konnte nicht geloescht werden.",
          };
        }
      },
      uploadUserAvatar: async (userId, file) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const payload = new FormData();
          payload.append("avatar", file);
          payload.append("actorId", actorId);

          const response = await fetch(`/api/users/${userId}/avatar`, {
            method: "POST",
            body: payload,
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Profilbild konnte nicht gespeichert werden.",
          };
        }
      },
      addMatch: async (input) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch("/api/matches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...input, actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Spiel konnte nicht gespeichert werden.",
          };
        }
      },
      updateMatch: async (matchId, input) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch(`/api/matches/${matchId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...input, actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Spiel konnte nicht gespeichert werden.",
          };
        }
      },
      deleteMatch: async (matchId) => {
        try {
          const actorId = get().currentUserId;

          if (!actorId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch(`/api/matches/${matchId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, actorId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Spiel konnte nicht geloescht werden.",
          };
        }
      },
      updateCurrentUser: async (input) => {
        try {
          const currentUserId = get().currentUserId;

          if (!currentUserId) {
            return { success: false, error: "Bitte zuerst anmelden." };
          }

          const response = await fetch(`/api/users/${currentUserId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...input, actorId: currentUserId }),
          });
          const data = (await readJson(response)) as ApiStatePayload;
          applyPayload(set, data, currentUserId);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Profil konnte nicht gespeichert werden.",
          };
        }
      },
      setTeamMembership: async (teamId, trainerIds, playerIds) => {
        try {
          const actorId = get().currentUserId;
          const response = await fetch(`/api/teams/${teamId}/members`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId, trainerIds, playerIds }),
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
          const actorId = get().currentUserId;

          if (!actorId) {
            return null;
          }

          const response = await fetch("/api/conversations/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, actorId }),
          });
          const data = (await readJson(response)) as ApiStatePayload & {
            conversationId: string;
          };
          applyPayload(set, data, actorId);

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
