import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Send, Trash2, UsersRound, X } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const users = useAppStore((state) => state.users);
  const teams = useAppStore((state) => state.teams);
  const conversations = useAppStore((state) => state.conversations);
  const messages = useAppStore((state) => state.messages);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const ensureDirectConversation = useAppStore((state) => state.ensureDirectConversation);
  const ensureTeamConversation = useAppStore((state) => state.ensureTeamConversation);
  const createTeamChannel = useAppStore((state) => state.createTeamChannel);
  const createGroupConversation = useAppStore((state) => state.createGroupConversation);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const deleteConversation = useAppStore((state) => state.deleteConversation);
  const [draft, setDraft] = useState("");
  const [directChatOpen, setDirectChatOpen] = useState(false);
  const [directChatUserId, setDirectChatUserId] = useState("");
  const [teamChatOpen, setTeamChatOpen] = useState(false);
  const [selectedTeamChatId, setSelectedTeamChatId] = useState("");
  const [createTeamChannelOpen, setCreateTeamChannelOpen] = useState(false);
  const [teamChannelTeamId, setTeamChannelTeamId] = useState("");
  const [teamChannelTitle, setTeamChannelTitle] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  const availableConversations = useMemo(
    () =>
      [...conversations].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [conversations],
  );

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    teams.forEach((team) => map.set(team.id, team.name));
    return map;
  }, [teams]);

  const userGroups = useMemo(() => {
    const others = users.filter((user) => user.id !== currentUserId);
    const admins = others
      .filter((user) => user.role === "admin")
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "de"));
    const board = others
      .filter((user) => user.role === "board")
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "de"));
    const trainers = others
      .filter((user) => user.role === "trainer")
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "de"));
    const players = others
      .filter((user) => user.role === "player")
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "de"));

    const playersByTeam = new Map<string, typeof players>();
    players.forEach((player) => {
      const teamKey =
        player.teamIds
          .map((id) => teamNameById.get(id))
          .filter(Boolean)
          .sort((a, b) => (a as string).localeCompare(b as string, "de"))[0] ??
        "Ohne Team";

      const list = playersByTeam.get(teamKey) ?? [];
      list.push(player);
      playersByTeam.set(teamKey, list);
    });

    const teamKeys = Array.from(playersByTeam.keys()).sort((a, b) =>
      a === "Ohne Team" ? 1 : b === "Ohne Team" ? -1 : a.localeCompare(b, "de"),
    );

    return [
      { label: "Admins", users: admins },
      { label: "Vorstand", users: board },
      { label: "Trainer", users: trainers },
      ...teamKeys.map((key) => ({
        label: key === "Ohne Team" ? "Spielerinnen (ohne Team)" : `Spielerinnen: ${key}`,
        users: (playersByTeam.get(key) ?? []).sort((a, b) =>
          a.fullName.localeCompare(b.fullName, "de"),
        ),
      })),
    ].filter((group) => group.users.length > 0);
  }, [currentUserId, teamNameById, users]);

  const availableTeamsForChat = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "admin" || currentUser.role === "board") {
      return teams;
    }

    return teams.filter((team) => currentUser.teamIds.includes(team.id));
  }, [currentUser, teams]);

  const canCreateTeamChannels = currentUser?.role === "admin" || currentUser?.role === "trainer";

  const selectedConversationId =
    searchParams.get("conversation") ?? availableConversations[0]?.id ?? null;
  const selectedConversation = availableConversations.find(
    (conversation) => conversation.id === selectedConversationId,
  );

  useEffect(() => {
    if (!selectedConversationId && availableConversations[0]) {
      setSearchParams({ conversation: availableConversations[0].id });
    }
  }, [availableConversations, selectedConversationId, setSearchParams]);

  useEffect(() => {
    if (
      selectedConversationId &&
      !selectedConversation &&
      availableConversations[0]
    ) {
      setSearchParams({ conversation: availableConversations[0].id });
    }
  }, [
    availableConversations,
    selectedConversation,
    selectedConversationId,
    setSearchParams,
  ]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
  }, []);

  const selectedMessages = messages
    .filter((message) => message.conversationId === selectedConversation?.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [selectedConversation?.id, selectedMessages.length]);

  const canDeleteSelectedConversation = useMemo(() => {
    if (!currentUser || !selectedConversation) {
      return false;
    }

    if (currentUser.role === "admin") {
      return true;
    }

    if (selectedConversation.type === "direct") {
      return selectedConversation.participantIds.includes(currentUser.id);
    }

    return (
      currentUser.role === "trainer" &&
      Boolean(selectedConversation.teamId) &&
      currentUser.teamIds.includes(selectedConversation.teamId as string)
    );
  }, [currentUser, selectedConversation]);

  const deleteDialogLabel = selectedConversation?.type === "team" ? "Teamchannel" : "Privatchat";

  const renderUserOptions = (includeCurrentUser = false) => {
    const groups = includeCurrentUser
      ? userGroups
      : userGroups.map((group) => ({
          ...group,
          users: group.users.filter((user) => user.id !== currentUserId),
        }));

    return groups.map((group) => (
      <optgroup key={group.label} label={group.label}>
        {group.users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.fullName}
          </option>
        ))}
      </optgroup>
    ));
  };

  const renderUserSelectionCards = () => {
    const groups = userGroups.map((group) => ({
      ...group,
      users: group.users.filter((user) => user.id !== currentUserId),
    }));

    return groups.map((group) => (
      <div key={group.label} className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">{group.label}</p>
        <div className="grid gap-2">
          {group.users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setDirectChatUserId(user.id)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                directChatUserId === user.id
                  ? "border-blue-300 bg-blue-50 text-blue-900 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-white"
              }`}
            >
              {user.fullName}
            </button>
          ))}
        </div>
      </div>
    ));
  };

  const getConversationTypeLabel = (conversation: (typeof availableConversations)[number]) => {
    if (conversation.type === "team") {
      return "Teamchannel";
    }

    return conversation.participantIds.length > 2 ? "Gruppenchat" : "Direktnachricht";
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <SectionCard
        title="Konversationen"
        description="Direktchat oder Teamchat oeffnen und sofort weiterschreiben."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDirectChatUserId("");
                setDirectChatOpen(true);
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white"
            >
              Direktchat starten
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedTeamChatId(availableTeamsForChat[0]?.id ?? "");
                setTeamChatOpen(true);
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white"
            >
              Teamchat oeffnen
            </button>

            <button
              type="button"
              onClick={() => {
                setGroupSelectedIds([]);
                setGroupTitle("");
                setCreateGroupOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <UsersRound size={18} />
              Gruppenchat
            </button>

            {canCreateTeamChannels ? (
              <button
                type="button"
                onClick={() => {
                  setTeamChannelTeamId(availableTeamsForChat[0]?.id ?? "");
                  setTeamChannelTitle("");
                  setCreateTeamChannelOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
              >
                <Plus size={18} />
                Neuer Teamchannel
              </button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-3">
          {availableConversations.map((conversation) => {
            const latestMessage = [...messages]
              .filter((message) => message.conversationId === conversation.id)
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSearchParams({ conversation: conversation.id })}
                className={`w-full rounded-3xl border p-4 text-left transition ${
                  selectedConversation?.id === conversation.id
                    ? "border-blue-200 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {conversation.title}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-blue-700">
                      {getConversationTypeLabel(conversation)}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(conversation.updatedAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                  {latestMessage?.content ?? "Noch keine Nachricht vorhanden."}
                </p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title={selectedConversation?.title ?? "Nachrichten"}
        description={
          selectedConversation
            ? "Kommunikation innerhalb des Vereins mit gemeinsamem Verlauf."
            : "Bitte zuerst eine Konversation auswaehlen."
        }
        actions={
          selectedConversation && canDeleteSelectedConversation ? (
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 size={18} />
              Loeschen
            </button>
          ) : null
        }
      >
        {selectedConversation ? (
          <div className="flex h-[640px] flex-col">
            <div
              ref={messagesContainerRef}
              className="flex-1 space-y-4 overflow-y-auto rounded-3xl bg-slate-50 p-4"
            >
              {selectedMessages.map((message) => {
                const sender = users.find((user) => user.id === message.senderId);
                const ownMessage = message.senderId === currentUserId;

                return (
                  <div
                    key={message.id}
                    className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-3xl px-4 py-3 shadow-sm ${
                        ownMessage
                          ? "bg-gradient-to-r from-blue-900 to-blue-700 text-white"
                          : "bg-white text-slate-700"
                      }`}
                    >
                      <p className={`text-xs ${ownMessage ? "text-blue-100" : "text-slate-500"}`}>
                        {sender?.fullName} ·{" "}
                        {new Date(message.createdAt).toLocaleString("de-DE")}
                      </p>
                      <p className="mt-2 text-sm leading-6">{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              className="mt-4 flex gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const result = await sendMessage(selectedConversation.id, draft);
                if (result.success) {
                  setDraft("");
                }
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="Nachricht schreiben..."
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
              >
                <Send size={18} />
                Senden
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">
            Keine Konversation vorhanden.
          </div>
        )}
      </SectionCard>

      {directChatOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Direktchat
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  Person auswaehlen
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDirectChatOpen(false)}
                className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 max-h-[26rem] space-y-5 overflow-y-auto pr-1">
              {renderUserSelectionCards()}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDirectChatOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!directChatUserId}
                onClick={async () => {
                  const conversationId = await ensureDirectConversation(directChatUserId);
                  if (conversationId) {
                    setDirectChatOpen(false);
                    setSearchParams({ conversation: conversationId });
                  }
                }}
                className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Oeffnen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {teamChatOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Teamchat
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  Mannschaft auswaehlen
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTeamChatOpen(false)}
                className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              {availableTeamsForChat.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamChatId(team.id)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                    selectedTeamChatId === team.id
                      ? "border-blue-300 bg-blue-50 text-blue-900 shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-white"
                  }`}
                >
                  {team.name}
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setTeamChatOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!selectedTeamChatId}
                onClick={async () => {
                  const conversationId = await ensureTeamConversation(selectedTeamChatId);
                  if (conversationId) {
                    setTeamChatOpen(false);
                    setSearchParams({ conversation: conversationId });
                  }
                }}
                className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Oeffnen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createTeamChannelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Neuer Teamchannel
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  Thema festlegen
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateTeamChannelOpen(false)}
                className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Mannschaft
                <select
                  value={teamChannelTeamId}
                  onChange={(event) => setTeamChannelTeamId(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                >
                  {availableTeamsForChat.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Thema (z.B. Training, Spiel gegen XYZ)
                <input
                  value={teamChannelTitle}
                  onChange={(event) => setTeamChannelTitle(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="Thema eingeben..."
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateTeamChannelOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!teamChannelTeamId || !teamChannelTitle.trim()}
                onClick={async () => {
                  const conversationId = await createTeamChannel(
                    teamChannelTeamId,
                    teamChannelTitle,
                  );
                  if (conversationId) {
                    setCreateTeamChannelOpen(false);
                    setSearchParams({ conversation: conversationId });
                  }
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} />
                Anlegen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createGroupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Gruppenchat
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  Teilnehmer auswaehlen
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateGroupOpen(false)}
                className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Titel (optional)
                <input
                  value={groupTitle}
                  onChange={(event) => setGroupTitle(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="z.B. Fahrgemeinschaft, Turnier, ..."
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Personen (mehrere auswahlen)
                <select
                  multiple
                  value={groupSelectedIds}
                  onChange={(event) => {
                    const selected = Array.from(event.target.selectedOptions).map(
                      (option) => option.value,
                    );
                    setGroupSelectedIds(selected);
                  }}
                  className="h-56 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                >
                  {renderUserOptions()}
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateGroupOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={groupSelectedIds.length === 0}
                onClick={async () => {
                  const conversationId = await createGroupConversation(
                    groupSelectedIds,
                    groupTitle.trim() ? groupTitle : undefined,
                  );
                  if (conversationId) {
                    setCreateGroupOpen(false);
                    setSearchParams({ conversation: conversationId });
                  }
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UsersRound size={18} />
                Starten
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteDialogOpen && selectedConversation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
              {deleteDialogLabel} loeschen
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {selectedConversation.title}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Beim Loeschen werden auch alle Nachrichten in diesem Channel entfernt.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = await deleteConversation(selectedConversation.id);
                  if (result.success) {
                    setDeleteDialogOpen(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-700/20 transition hover:bg-rose-700"
              >
                <Trash2 size={18} />
                Endgueltig loeschen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
