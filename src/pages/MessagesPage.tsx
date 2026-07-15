import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
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
  const sendMessage = useAppStore((state) => state.sendMessage);
  const [draft, setDraft] = useState("");
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

  const availableTeamsForChat = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "admin" || currentUser.role === "board") {
      return teams;
    }

    return teams.filter((team) => currentUser.teamIds.includes(team.id));
  }, [currentUser, teams]);

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

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <SectionCard
        title="Konversationen"
        description="Direktchat oder Teamchat oeffnen und sofort weiterschreiben."
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              defaultValue=""
              onChange={async (event) => {
                if (!event.target.value) {
                  return;
                }
                const conversationId = await ensureDirectConversation(event.target.value);
                if (conversationId) {
                  setSearchParams({ conversation: conversationId });
                }
                event.target.value = "";
              }}
            >
              <option value="">Direktchat starten</option>
              {users
                .filter((user) => user.id !== currentUserId)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
            </select>

            <select
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              defaultValue=""
              onChange={async (event) => {
                if (!event.target.value) {
                  return;
                }
                const conversationId = await ensureTeamConversation(event.target.value);
                if (conversationId) {
                  setSearchParams({ conversation: conversationId });
                }
                event.target.value = "";
              }}
            >
              <option value="">Teamchat oeffnen</option>
              {availableTeamsForChat.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
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
                      {conversation.type === "team" ? "Teamchat" : "Direktnachricht"}
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
    </div>
  );
}
