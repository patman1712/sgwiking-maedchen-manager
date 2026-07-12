import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

export default function ProfilePage() {
  const users = useAppStore((state) => state.users);
  const teams = useAppStore((state) => state.teams);
  const currentUserId = useAppStore((state) => state.currentUserId);

  const currentUser = users.find((user) => user.id === currentUserId);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <SectionCard
        title="Mein Profil"
        description="Persoenliche Daten und Rollenansicht fuer den aktuell angemeldeten Benutzer."
      >
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Name</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{currentUser.fullName}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">E-Mail</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{currentUser.email}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Telefon</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{currentUser.phone}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Rolle</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {currentUser.role === "admin"
                ? "Vereinsadmin"
                : currentUser.role === "trainer"
                  ? "Trainerin / Trainer"
                  : "Spielerin"}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Meine Mannschaften"
        description="Alle Teams, denen dein Benutzer aktuell zugeordnet ist."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {currentUser.teamIds.map((teamId) => {
            const team = teams.find((entry) => entry.id === teamId);

            if (!team) {
              return null;
            }

            return (
              <div key={team.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-700">
                  {team.ageGroup}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{team.name}</h3>
                <p className="mt-3 text-sm text-slate-600">{team.trainingDay}</p>
                <p className="mt-1 text-sm text-slate-500">{team.location}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-3xl bg-gradient-to-r from-blue-50 to-white p-5">
          <p className="text-sm font-medium text-slate-900">Interne Notiz</p>
          <p className="mt-2 text-sm text-slate-600">{currentUser.notes || "Keine Notiz hinterlegt."}</p>
        </div>
      </SectionCard>
    </div>
  );
}
