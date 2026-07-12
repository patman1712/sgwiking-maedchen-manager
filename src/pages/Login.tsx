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
  {
    role: "Vorstand",
    email: "vorstand@wiking-verein.de",
    password: "vorstand123",
  },
];

export default function Login() {
  const [email, setEmail] = useState(demoAccounts[0].email);
  const [password, setPassword] = useState(demoAccounts[0].password);
  const [error, setError] = useState("");
  const users = useAppStore((state) => state.users);
  const settings = useAppStore((state) => state.settings);
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
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,_#0b3ea8,_#0a58ca_55%,_#1c6cf0)] px-4 py-10">
      <section className="w-full max-w-md rounded-xl bg-white px-7 py-8 shadow-[0_24px_60px_rgba(2,30,84,0.35)]">
        <div className="text-center">
          <div className="mx-auto flex min-h-24 items-center justify-center">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Teamwappen"
                className="max-h-24 max-w-[220px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-700 text-white shadow">
                  <ShieldCheck size={28} />
                </div>
                <div className="text-left">
                  <p className="text-3xl font-extrabold tracking-tight text-blue-800">
                    SG WIKING
                  </p>
                  <p className="text-lg font-semibold text-slate-700">OFFENBACH</p>
                </div>
              </div>
            )}
          </div>
          <p className="mt-4 text-sm text-slate-500">Management System</p>
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Benutzername</span>
            <span className="relative block">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                className="w-full rounded-md border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Benutzername eingeben"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Passwort</span>
            <span className="relative block">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                className="w-full rounded-md border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Passwort eingeben"
                required
              />
            </span>
          </label>

          <button
            type="submit"
            className="mt-2 w-full rounded-md bg-[#0b4fc5] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#093d96]"
          >
            Anmelden
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-center text-xs text-slate-400">
            {settings.clubName} · {accountCount} aktive Konten
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.role}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  setError("");
                }}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 transition hover:bg-blue-100"
              >
                {account.role}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
