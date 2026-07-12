import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialAppState, useAppStore } from "@/store";
import type { UserProfile } from "@/types";

const bootstrapPayload = {
  success: true,
  teams: [
    {
      id: "team_u13",
      name: "SG Wiking U13",
      ageGroup: "U13",
      season: "2026/2027",
      trainingDay: "Montag",
      location: "Platz 1",
      notes: "",
      createdAt: "2026-07-12T10:00:00.000Z",
    },
  ],
  users: [
    {
      id: "user_admin",
      fullName: "Lena Hoffmann",
      email: "admin@wiking-verein.de",
      phone: "0170",
      role: "admin" as const,
      teamIds: ["team_u13"],
      notes: "",
      createdAt: "2026-07-12T10:00:00.000Z",
    },
  ] satisfies UserProfile[],
  conversations: [
    {
      id: "conversation_team_u13",
      title: "SG Wiking U13 Teamchat",
      type: "team",
      teamId: "team_u13",
      participantIds: ["user_admin"],
      updatedAt: "2026-07-12T10:00:00.000Z",
    },
  ],
  messages: [],
  currentUser: {
    id: "user_admin",
    fullName: "Lena Hoffmann",
    email: "admin@wiking-verein.de",
    phone: "0170",
    role: "admin",
    teamIds: ["team_u13"],
    notes: "",
    createdAt: "2026-07-12T10:00:00.000Z",
  },
};

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.setState({ ...initialAppState });
    vi.restoreAllMocks();
  });

  it("meldet einen Benutzer ueber die API an und laedt Daten", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: { id: "user_admin" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => bootstrapPayload,
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await useAppStore
      .getState()
      .login("admin@wiking-verein.de", "admin123");

    expect(result.success).toBe(true);
    expect(useAppStore.getState().currentUserId).toBe("user_admin");
    expect(useAppStore.getState().teams).toHaveLength(1);
  });

  it("legt eine Mannschaft ueber die API an", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...bootstrapPayload,
          teams: [
            {
              id: "team_new",
              name: "SG Wiking U11",
              ageGroup: "U11",
              season: "2026/2027",
              trainingDay: "Freitag",
              location: "Platz 2",
              notes: "",
              createdAt: "2026-07-12T11:00:00.000Z",
            },
            ...bootstrapPayload.teams,
          ],
        }),
      }),
    );

    const result = await useAppStore.getState().addTeam({
      name: "SG Wiking U11",
      ageGroup: "U11",
      season: "2026/2027",
      trainingDay: "Freitag",
      location: "Platz 2",
      notes: "",
    });

    expect(result.success).toBe(true);
    expect(useAppStore.getState().teams[0].name).toBe("SG Wiking U11");
  });

  it("erstellt einen Direktchat und sendet eine Nachricht", async () => {
    useAppStore.setState({
      ...initialAppState,
      currentUserId: "user_admin",
      users: [
        ...bootstrapPayload.users,
        {
          id: "user_player_1",
          fullName: "Nele Hansen",
          email: "nele@wiking.de",
          phone: "0151",
          role: "player" as const,
          teamIds: [],
          notes: "",
          createdAt: "2026-07-12T10:00:00.000Z",
        },
      ],
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...bootstrapPayload,
          conversationId: "conversation_direct_new",
          conversations: [
            ...bootstrapPayload.conversations,
            {
              id: "conversation_direct_new",
              title: "Lena Hoffmann & Nele Hansen",
              type: "direct",
              participantIds: ["user_admin", "user_player_1"],
              updatedAt: "2026-07-12T11:10:00.000Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...bootstrapPayload,
          conversations: [
            ...bootstrapPayload.conversations,
            {
              id: "conversation_direct_new",
              title: "Lena Hoffmann & Nele Hansen",
              type: "direct",
              participantIds: ["user_admin", "user_player_1"],
              updatedAt: "2026-07-12T11:11:00.000Z",
            },
          ],
          messages: [
            {
              id: "message_new",
              conversationId: "conversation_direct_new",
              senderId: "user_admin",
              content: "Willkommen im Teamchat",
              createdAt: "2026-07-12T11:11:00.000Z",
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const conversationId = await useAppStore
      .getState()
      .ensureDirectConversation("user_player_1");

    expect(conversationId).toBe("conversation_direct_new");

    const result = await useAppStore
      .getState()
      .sendMessage("conversation_direct_new", "Willkommen im Teamchat");

    expect(result.success).toBe(true);
    expect(useAppStore.getState().messages.at(-1)?.content).toBe(
      "Willkommen im Teamchat",
    );
  });
});
