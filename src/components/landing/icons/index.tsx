import { useId, type SVGProps } from 'react';

/**
 * Hand-crafted icon set for the eLoyer Kinshasa landing page.
 * 24px grid, 1.75 stroke, round caps — consistent optical weight across the page.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Base({ size = 24, title, children, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ── Product / feature icons ─────────────────────────────────── */

export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </Base>
  );
}

export function MobileMoneyIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10 5.5h4" />
      <path d="M12 9v1M12 15v1" />
      <path d="M13.8 10.6a2 2 0 0 0-1.8-.9c-1.1 0-1.9.6-1.9 1.4 0 1.9 3.8.9 3.8 2.8 0 .8-.8 1.4-1.9 1.4a2 2 0 0 1-1.9-1" />
    </Base>
  );
}

export function QrReceiptIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 3.5h14v17l-2.3-1.5-2.4 1.5-2.3-1.5-2.3 1.5-2.4-1.5L5 20.5z" />
      <rect x="8.5" y="7" width="3" height="3" rx=".5" />
      <rect x="12.5" y="7" width="3" height="3" rx=".5" />
      <rect x="8.5" y="11" width="3" height="3" rx=".5" />
      <path d="M13 11h1.5v1.5M15.5 14H14" />
    </Base>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 20.5h17" />
      <path d="M6 16.5v-4M10.5 16.5v-8M15 16.5v-5.5M19.5 16.5v-10" />
      <path d="m5.5 8.5 4.5-3 4.5 2.5 5-4.5" />
    </Base>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c.6-3.7 3.7-6 7.5-6s6.9 2.3 7.5 6" />
    </Base>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20.5h16" />
      <path d="M6 20.5v-15l6-2.5 6 2.5v15" />
      <path d="M9 9h1.5M13.5 9H15M9 12.5h1.5M13.5 12.5H15M9 16h1.5M13.5 16H15" />
    </Base>
  );
}

export function LandmarkIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 9.5 12 4l8.5 5.5z" />
      <path d="M5.5 9.5v8M9.8 9.5v8M14.2 9.5v8M18.5 9.5v8" />
      <path d="M3.5 20.5h17M5 17.5h14" />
    </Base>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3 5 5.8v5.4c0 4.4 2.9 8.2 7 9.8 4.1-1.6 7-5.4 7-9.8V5.8z" />
      <path d="m9 12 2 2 4-4.5" />
    </Base>
  );
}

export function FingerprintIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 10a6 6 0 0 1 12 0v3.5" />
      <path d="M8.5 10a3.5 3.5 0 0 1 7 0c0 3-.6 6-2 8.5" />
      <path d="M12 10v2.5c0 2.7-.8 5.2-2.2 7.3" />
      <path d="M4 14.5c.7-1.3 1-2.9 1-4.5a7 7 0 0 1 2-4.9" />
      <path d="M14.8 18.8c.5-1.3.8-2.6 1-4" />
    </Base>
  );
}

export function PhoneBasicIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M9.5 6.5h5M9.5 9.5h5M10 15h.01M12 15h.01M14 15h.01M10 17.5h.01M12 17.5h.01M14 17.5h.01" />
    </Base>
  );
}

export function StampIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 20.5h14" />
      <path d="M6 17.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1H6z" />
      <path d="M9.5 15.5v-2.4a2.5 2.5 0 1 1 5 0v2.4" />
      <path d="m9 7.5 2 2 4-4.5" />
    </Base>
  );
}

export function HeadsetIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 13v-1.5a7.5 7.5 0 0 1 15 0V13" />
      <rect x="3.5" y="12.5" width="4" height="6" rx="1.5" />
      <rect x="16.5" y="12.5" width="4" height="6" rx="1.5" />
      <path d="M18.5 18.5a3.5 3.5 0 0 1-3.5 3h-2" />
    </Base>
  );
}

/* ── Process icons ───────────────────────────────────────────── */

export function UserPlusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10" cy="8" r="4" />
      <path d="M3 20.5c.5-3.6 3.4-6 7-6 1.3 0 2.5.3 3.5.9" />
      <path d="M18.5 14v6M15.5 17h6" />
    </Base>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4" />
      <path d="M9.5 12h5M9.5 15.5h5" />
    </Base>
  );
}

export function CreditCardIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M7 14.5h3" />
    </Base>
  );
}

export function FileCheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4" />
      <path d="m9.5 14 2 2 3.5-4" />
    </Base>
  );
}

/* ── UI glyphs ───────────────────────────────────────────────── */

export function CheckIcon(props: IconProps) {
  return (
    <Base strokeWidth={2.25} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Base>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Base strokeWidth={2} {...props}>
      <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
    </Base>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Base strokeWidth={2} {...props}>
      <path d="M6.5 17.5 17.5 6.5M8.5 6.5h9v9" />
    </Base>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Base strokeWidth={2} {...props}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Base strokeWidth={2} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Base>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Base strokeWidth={2} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Base>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <Base {...props} stroke="none" fill="currentColor">
      <path d="M9.6 6.5C6.5 7.6 4.5 10 4.5 13.2c0 2.6 1.7 4.3 3.9 4.3 1.9 0 3.4-1.4 3.4-3.3 0-1.8-1.3-3.1-3-3.1-.3 0-.6 0-.8.1.4-1.6 1.6-2.8 3.3-3.4zm9.4 0c-3.1 1.1-5.1 3.5-5.1 6.7 0 2.6 1.7 4.3 3.9 4.3 1.9 0 3.4-1.4 3.4-3.3 0-1.8-1.3-3.1-3-3.1-.3 0-.6 0-.8.1.4-1.6 1.6-2.8 3.3-3.4z" />
    </Base>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5v2" />
    </Base>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.7 5.4 3.7 8.5s-1.2 5.9-3.7 8.5c-2.5-2.6-3.7-5.4-3.7-8.5s1.2-5.9 3.7-8.5z" />
    </Base>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5c.4 4.4 3.6 7.6 8 8-4.4.4-7.6 3.6-8 8-.4-4.4-3.6-7.6-8-8 4.4-.4 7.6-3.6 8-8z" />
    </Base>
  );
}

/* ── Social ──────────────────────────────────────────────────── */

export function FacebookIcon(props: IconProps) {
  return (
    <Base {...props} stroke="none" fill="currentColor">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21z" />
    </Base>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Base {...props} stroke="none" fill="currentColor">
      <path d="M17.2 3.5h3l-6.6 7.6 7.8 10.4h-6.1l-4.8-6.3-5.5 6.3h-3l7.1-8.1L1.6 3.5h6.3l4.3 5.7zm-1.1 16.1h1.7L7 5.3H5.2z" />
    </Base>
  );
}

export function LinkedInIcon(props: IconProps) {
  return (
    <Base {...props} stroke="none" fill="currentColor">
      <path d="M6.5 8.5H3.6V20h2.9zM5 3.8a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM20.4 13.6c0-3.2-1.7-5.3-4.3-5.3-1.6 0-2.7.8-3.2 1.7V8.5H10V20h2.9v-6c0-1.6.6-2.8 2.1-2.8 1.4 0 2 1 2 2.8v6h2.9z" />
    </Base>
  );
}

export function YouTubeIcon(props: IconProps) {
  return (
    <Base {...props} stroke="none" fill="currentColor">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" />
    </Base>
  );
}

/* ── Flag of the Democratic Republic of the Congo ────────────── */

export function DRCFlag({
  width = 24,
  className,
  title = 'Drapeau de la République Démocratique du Congo',
}: {
  width?: number;
  className?: string;
  title?: string;
}) {
  const height = Math.round((width * 3) / 4);
  const clipId = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 32 24"
      className={className}
      role="img"
      aria-label={title}
      focusable="false"
    >
      <title>{title}</title>
      <rect width="32" height="24" rx="2" fill="#009FE3" />
      <clipPath id={clipId}>
        <rect width="32" height="24" rx="2" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <line x1="-2" y1="26" x2="34" y2="-2" stroke="#FFDD00" strokeWidth="8" />
        <line x1="-2" y1="26" x2="34" y2="-2" stroke="#EF3E42" strokeWidth="5" />
      </g>
      <path
        fill="#FFDD00"
        d="m6.6 3.2 1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4L4.1 10.8l.6-2.8L2.6 6.1l2.8-.3z"
      />
    </svg>
  );
}
