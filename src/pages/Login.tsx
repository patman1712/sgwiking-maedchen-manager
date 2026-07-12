import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { useAppStore } from "@/store";

const demoAccounts = [
  {
    role: "Admin",
    email: "admin@wiking-verein.de",
    password: "admin123",
  },
  {
    role: "Trainerin",
    email: "maren.schulz@wiking-verein.de",
    password: "trainer123",
  },
  {
    role: "Spielerin",
    email: "nele.hansen@wiking-verein.de",
    password: "spielerin123",
  },
];

export default function Login() {
  const [email, setEmail] = useState(demoAccounts[0].email);
  const [password, setPassword] = useState(demoAccounts[0].password);
  const [error, setError] = useState("");
  const users = useAppStore((state) => state.users);
  const fetchData = useAppStore((state) => state.fetchData);
  const login = useAppStore((state) => state.login);
  const navigate = useNavigate();

  const accountCount = useMemo(() => users.length, [users.length]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await login(email, password);

    if (!result.success) {
      setError(result.error ?? "Anmeldung fehlgeschlagen.");
      return;
    }

    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.24),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(192,38,211,0.22),_transparent_30%),linear-gradient(135deg,_#0f172a,_#172554_55%,_#581c87)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-white shadow-2xl backdrop-blur md:p-10">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-blue-100">
            <ShieldCheck size={16} />
            Vereinsplattform fuer Organisation, Kommunikation und Login
          </div>

          <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight md:text-5xl">
            Der Vereinsmanager im Stil deines Maintextildruck-Systems.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-blue-100 md:text-lg">
            Mehrere Mannschaften anlegen, Trainerinnen und Spielerinnen verwalten,
            Logins vergeben und direkt im Verein kommunizieren.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-3xl font-semibold">3</p>
              <p className="mt-2 text-sm text-blue-100">Mannschaften als Startsetup</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-3xl font-semibold">{accountCount}</p>
              <p className="mt-2 text-sm text-blue-100">Vorgelegte Nutzerkonten</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-3xl font-semibold">Live</p>
              <p className="mt-2 text-sm text-blue-100">Direkt nutzbare Demo fuer Railway</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200/70 bg-white/95 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-700 to-fuchsia-600 text-white shadow-lg">
              <ShieldCheck size={28} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-slate-900">
              Anmelden
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Vereinszugang fuer Admin, Trainerinnen und Spielerinnen
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">E-Mail</span>
              <span className="relative block">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@verein.de"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Passwort</span>
              <span className="relative block">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Passwort eingeben"
                  required
                />
              </span>
            </label>

            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-blue-700 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Jetzt anmelden
            </button>
          </form>

          <div className="mt-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Demo-Zugaenge
            </p>
            {demoAccounts.map((account) => (
              <button
                key={account.role}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  setError("");
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{account.role}</p>
                  <p className="text-xs text-slate-500">{account.email}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                  {account.password}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
