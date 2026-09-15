import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { motion, useMotionTemplate, useReducedMotion, useSpring } from 'framer-motion';
import { cn } from '@/lib/cn';
import { ChartIcon, HomeIcon, LockIcon, QrReceiptIcon, UserIcon, FileTextIcon, CreditCardIcon } from '../icons';

const DESIGN_WIDTH = 640;
const DESIGN_HEIGHT = 424;

const KPIS = [
  { label: 'Logements', value: '12', delta: '+2', tone: 'blue' },
  { label: 'Locataires', value: '11', delta: '+1', tone: 'navy' },
  { label: 'Loyers perçus', value: '8 450 000', unit: 'FC', delta: '+12 %', tone: 'yellow' },
  { label: 'Recettes fiscales', value: '1 267 500', unit: 'FC', delta: '+9 %', tone: 'red' },
] as const;

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const BARS = [46, 52, 48, 61, 58, 66, 72, 69, 78, 84, 80, 92];

const PAYMENTS = [
  { initials: 'JN', name: 'Jeanne Nsimba', where: 'Gombe · Appt 4B', amount: '650 000 FC', method: 'Orange Money' },
  { initials: 'PM', name: 'Patrick Mbuyi', where: 'Lingwala · Villa 2', amount: '900 000 FC', method: 'M-Pesa' },
  { initials: 'AK', name: 'Alice Kalala', where: 'Limete · Studio 7', amount: '350 000 FC', method: 'Airtel Money' },
  { initials: 'DL', name: 'David Lukusa', where: 'Ngaliema · Appt 1A', amount: '780 000 FC', method: 'Banque' },
];

const KPI_ACCENT: Record<string, string> = {
  blue: 'bg-drc-blue',
  navy: 'bg-drc-navy',
  yellow: 'bg-drc-yellow',
  red: 'bg-drc-red',
};

function useScaleToFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(el.clientWidth / DESIGN_WIDTH, 1.15));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, scale };
}

interface FloatingDashboardProps {
  className?: string;
  /** Disable the 3D tilt (used on small screens). */
  flat?: boolean;
}

/**
 * A coded, pixel-perfect mockup of the landlord dashboard — crisper than a screenshot,
 * weightless, and animated. Rendered at a fixed design size and scaled to its container.
 */
export function FloatingDashboard({ className, flat = false }: FloatingDashboardProps) {
  const { ref, scale } = useScaleToFit();
  const reduce = useReducedMotion();
  const tiltEnabled = !flat && !reduce;

  // Physics-based tilt that follows the cursor and settles back to its resting pose.
  const spring = { stiffness: 170, damping: 26, mass: 1 };
  const rx = useSpring(4, spring);
  const ry = useSpring(-8, spring);
  const tilt = useMotionTemplate`rotateX(${rx}deg) rotateY(${ry}deg)`;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!tiltEnabled || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rx.set(4 - py * 8);
    ry.set(-8 + px * 10);
  };

  const onLeave = () => {
    if (!tiltEnabled) return;
    rx.set(4);
    ry.set(-8);
  };

  return (
    <div
      ref={ref}
      className={cn('relative w-full', className)}
      style={{ height: DESIGN_HEIGHT * scale }}
      aria-label="Aperçu du tableau de bord bailleur eLoyer Kinshasa"
      role="img"
    >
      <div className="lp-dash-glow" aria-hidden="true" />
      <div
        aria-hidden="true"
        className={cn('absolute left-0 top-0', !flat && 'lp-dash-scene')}
        style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <div className={cn(!reduce && 'lp-dash-float')} onPointerMove={onMove} onPointerLeave={onLeave}>
          <motion.div style={{ transform: tiltEnabled ? tilt : 'none' }} className="lp-dash-frame">
            <BrowserChrome />
            <div className="flex" style={{ height: DESIGN_HEIGHT - 36 }}>
              <Sidebar />
              <Main />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function BrowserChrome() {
  return (
    <div className="flex h-9 items-center gap-3 border-b border-white/[0.06] bg-[#0b1729] px-3.5">
      <div className="flex gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div className="mx-auto flex h-6 w-[300px] items-center justify-center gap-1.5 rounded-md bg-white/[0.06] text-[10px] text-white/55">
        <LockIcon size={10} />
        app.eloyer-kinshasa.cd/bailleur/tableau-de-bord
      </div>
      <span className="w-[42px]" />
    </div>
  );
}

function Sidebar() {
  const items = [
    { label: 'Tableau de bord', Icon: ChartIcon, active: true },
    { label: 'Mes biens', Icon: HomeIcon },
    { label: 'Locataires', Icon: UserIcon },
    { label: 'Contrats', Icon: FileTextIcon },
    { label: 'Paiements', Icon: CreditCardIcon },
    { label: 'Reçus', Icon: QrReceiptIcon },
  ];
  return (
    <aside className="flex w-[148px] shrink-0 flex-col bg-drc-navy px-3 py-4 text-white">
      <div className="flex items-center gap-2 px-1">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-drc-blue-ink font-heading text-[11px] font-extrabold">
          eL
        </span>
        <span className="font-heading text-[12px] font-bold leading-none">
          eLoyer <span className="text-white/60">Kin</span>
        </span>
      </div>
      <nav className="mt-5 flex flex-col gap-0.5" aria-hidden="true">
        {items.map(({ label, Icon, active }) => (
          <div
            key={label}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-[7px] text-[10.5px] font-medium',
              active ? 'bg-white/10 text-white' : 'text-white/70',
            )}
          >
            <Icon size={13} />
            {label}
            {active ? <span className="ml-auto h-1 w-1 rounded-full bg-drc-yellow" /> : null}
          </div>
        ))}
      </nav>
      <div className="mt-auto rounded-lg bg-white/[0.06] p-2.5">
        <p className="text-[9px] uppercase tracking-[1px] text-white/70">Conformité</p>
        <p className="mt-1 font-heading text-[13px] font-bold text-drc-yellow">100 %</p>
        <div className="mt-1.5 h-1 rounded-full bg-white/10">
          <div className="h-1 w-full rounded-full bg-drc-yellow" />
        </div>
      </div>
    </aside>
  );
}

function Main() {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-drc-gray-100 px-4 py-3.5 text-drc-navy">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading text-[13px] font-bold leading-none">Bonjour, M. Kabongo</p>
          <p className="mt-1 text-[9.5px] text-drc-gray-600">Mardi 15 septembre · Gombe, Kinshasa</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-drc-gray-200 bg-white px-2 py-1 text-[9px] font-semibold text-drc-gray-600">
            <span className="lp-dash-live h-1.5 w-1.5 rounded-full bg-emerald-500" />
            En direct
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-drc-navy text-[9px] font-bold text-white">
            MK
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="relative overflow-hidden rounded-lg border border-drc-gray-200 bg-white p-2.5">
            <span className={cn('absolute left-0 top-0 h-full w-[3px]', KPI_ACCENT[kpi.tone])} />
            <p className="text-[8.5px] font-medium uppercase tracking-[0.6px] text-drc-gray-500">{kpi.label}</p>
            <p className="lp-tabular mt-1 font-heading text-[14px] font-extrabold leading-none">
              {kpi.value}
              {'unit' in kpi ? <span className="ml-0.5 text-[8px] font-semibold text-drc-gray-500">{kpi.unit}</span> : null}
            </p>
            <p className="mt-1 text-[8.5px] font-semibold text-emerald-700">{kpi.delta} ce mois</p>
          </div>
        ))}
      </div>

      <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-2">
        <div className="flex flex-col rounded-lg border border-drc-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold">Recettes locatives</p>
            <p className="text-[8.5px] text-drc-gray-500">12 derniers mois · FC</p>
          </div>
          <div className="mt-2 flex h-[128px] items-stretch gap-[6px]" aria-hidden="true">
            {BARS.map((h, i) => (
              <div key={MONTHS[i]! + i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={cn('lp-dash-bar w-full rounded-t-[3px]', i === BARS.length - 1 ? 'bg-drc-yellow' : 'bg-drc-blue')}
                    style={{ height: `${h}%`, animationDelay: `${400 + i * 60}ms`, opacity: i === BARS.length - 1 ? 1 : 0.55 + (i / BARS.length) * 0.45 }}
                  />
                </div>
                <span className="text-[7.5px] font-medium text-drc-gray-500">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col rounded-lg border border-drc-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold">Paiements récents</p>
            <span className="text-[8.5px] font-semibold text-drc-blue-ink">Tout voir</span>
          </div>
          <ul className="mt-2 flex flex-col gap-[7px]">
            {PAYMENTS.map((p) => (
              <li key={p.name} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-drc-gray-100 text-[8px] font-bold text-drc-navy">
                  {p.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[9.5px] font-semibold leading-tight">{p.name}</span>
                  <span className="block truncate text-[8px] text-drc-gray-500">{p.where}</span>
                </span>
                <span className="text-right">
                  <span className="lp-tabular block text-[9.5px] font-bold leading-tight">{p.amount}</span>
                  <span className="flex items-center justify-end gap-1 text-[7.5px] font-semibold text-emerald-700">
                    <QrReceiptIcon size={8} /> Reçu
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
