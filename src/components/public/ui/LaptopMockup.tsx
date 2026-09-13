import { Building2, Users, TrendingUp, Wallet } from 'lucide-react';

export function LaptopMockup() {
  return (
    <div
      className="absolute right-0 top-16 z-0 hidden w-[380px] mockup-shadow lg:block"
      role="img"
      aria-label="Aperçu du tableau de bord web eLoyer Kinshasa"
    >
      {/* Screen */}
      <div className="overflow-hidden rounded-t-lg border-2 border-[#2a2a2a] border-b-0 bg-[#1a1a1a]">
        <div className="flex h-[220px] bg-[#f1f5f9]">
          {/* Sidebar */}
          <div className="w-14 shrink-0 bg-[var(--navy-900)] p-2">
            <div className="mb-3 h-5 w-5 rounded bg-[var(--brand-gold)]" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="mb-2 h-3 w-full rounded bg-white/10" />
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-3">
            <p className="mb-2 font-heading text-[10px] font-bold text-[var(--navy-900)]">
              Tableau de bord
            </p>

            {/* KPI cards */}
            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {[
                { icon: Building2, value: '5', label: 'Logements' },
                { icon: Users, value: '8', label: 'Locataires' },
                { icon: Wallet, value: '2.45M', label: 'Revenus' },
                { icon: TrendingUp, value: '1.2M', label: 'Encaissé' },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="rounded bg-white p-1.5 shadow-sm">
                  <Icon className="mb-0.5 h-2.5 w-2.5 text-[var(--blue-primary)]" aria-hidden="true" />
                  <p className="text-[8px] font-bold text-[var(--navy-900)]">{value}</p>
                  <p className="text-[6px] text-[var(--text-muted)]">{label}</p>
                </div>
              ))}
            </div>

            {/* Chart placeholder */}
            <div className="mb-2 rounded bg-white p-2 shadow-sm">
              <p className="mb-1 text-[7px] text-[var(--text-muted)]">Revenus mensuels</p>
              <div className="flex h-10 items-end gap-1">
                {[40, 55, 35, 70, 50, 80, 65].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-[var(--blue-primary)]"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="rounded bg-white p-1.5 shadow-sm">
              <p className="mb-1 text-[7px] font-medium text-[var(--navy-900)]">Transactions récentes</p>
              {[1, 2].map((i) => (
                <div key={i} className="mb-0.5 flex justify-between border-b border-gray-100 pb-0.5">
                  <span className="text-[6px] text-[var(--text-secondary)]">Paiement loyer</span>
                  <span className="text-[6px] font-medium text-[var(--success)]">+750K FC</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Base */}
      <div className="relative">
        <div className="mx-auto h-2 w-[95%] rounded-b-sm bg-[#3a3a3a]" />
        <div className="mx-auto h-1 w-[110%] -translate-x-[5%] rounded-b-lg bg-[#2a2a2a]" />
      </div>
    </div>
  );
}
