import { Link } from "react-router-dom";
import { MessageSquare, ShieldCheck, Users, Volleyball } from "lucide-react";
import { useAppStore } from "@/store";
import StatCard from "@/components/StatCard";
import SectionCard from "@/components/SectionCard";

export default function DashboardHome() {
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const messages = useAppStore((state) => state.messages);
  const conversations = useAppStore((state) => state.conversations);

  const trainers = users.filter((user) => user.role === "trainer");
  const players = users.filter((user) => user.role === "player");
  const recentMessages = [...messages]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-r from-blue-950 via-blue-900 to-blue-700 p-8 text-white shadow-[0_30px_80px_rgba(30,41,59,0.2)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
          Vereinsuebersicht
        </p>
        <h2 className="mt-3 text-3xl font-semibold">
          Alles Wichtige fuer eure Maedchenfussball-Organisation auf einen Blick
        </h2>
        <p className="mt-4 max-w-3xl text-sm text-blue-100 sm:text-base">
          Die App ist bewusst nach dem Muster deines Maintextildruck-Managers
          aufgebaut: klares Dashboard, linke Hauptnavigation und direkte Wege in
          Teams, Personen und Nachrichten.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/dashboard/teams"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-blue-900 shadow-lg transition hover:-translate-y-0.5"
          >
            Mannschaften verwalten
          </Link>
          <Link
            to="/dashboard/messages"
            className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Nachrichten oeffnen
          </Link>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard
          title="Mannschaften"
          value={String(teams.length)}
          description="Mehrere Jugendteams koennen parallel verwaltet werden."
          icon={Volleyball}
        />
        <StatCard
          title="Trainerinnen"
          value={String(trainers.length)}
          description="Trainerzugriffe fuer Teamsteuerung und Kommunikation."
          icon={ShieldCheck}
        />
        <StatCard
          title="Spielerinnen"
          value={String(players.length)}
          description="Kader, Logins und Teamzuordnungen zentral gepflegt."
          icon={Users}
        />
        <StatCard
          title="Konversationen"
          value={String(conversations.length)}
          description="Direktnachrichten und Teamchats an einem Ort."
          icon={MessageSquare}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Aktive Mannschaften"
          description="Trainingsinfos und Teamgroessen nach dem Vorbild deiner bestehenden Verwaltungsansicht."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => {
              const teamUsers = users.filter((user) => user.teamIds.includes(team.id));
              return (
                <Link
                  key={team.id}
                  to={`/dashboard/teams/${team.id}`}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                        {team.ageGroup}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {team.name}
                      </h3>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">
                      {teamUsers.length} Personen
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">{team.trainingDay}</p>
                  <p className="mt-2 text-sm text-slate-500">{team.location}</p>
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Letzte Nachrichten"
          description="Die Kommunikationsansicht arbeitet mit Team- und Direktchats."
        >
          <div className="space-y-3">
            {recentMessages.map((message) => {
              const sender = users.find((user) => user.id === message.senderId);
              const conversation = conversations.find(
                (entry) => entry.id === message.conversationId,
              );

              return (
                <div
                  key={message.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {sender?.fullName}
                    </p>
                    <span className="text-xs text-slate-500">
                      {new Date(message.createdAt).toLocaleString("de-DE")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-blue-700">
                    {conversation?.title}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">{message.content}</p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
