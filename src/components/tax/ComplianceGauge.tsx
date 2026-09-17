import { COMPLIANCE_COLORS, complianceLevelFromScore, type ComplianceLevel } from '@/types/tax';
import { cn } from '@/lib/utils';

interface ComplianceGaugeProps {
  /** 0-100 */
  score: number;
  level?: ComplianceLevel;
  size?: number;
  className?: string;
  label?: string;
}

/**
 * Semi-circular gauge (0-100). Colour follows the compliance level thresholds
 * used by `check_compliance_score` (90 / 75 / 50).
 */
export function ComplianceGauge({ score, level, size = 200, className, label = 'Score de conformité' }: ComplianceGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const resolvedLevel = level ?? complianceLevelFromScore(clamped);
  const colors = COMPLIANCE_COLORS[resolvedLevel];

  const stroke = size * 0.09;
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * radius; // half circle
  const dash = (clamped / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;
  const height = size / 2 + stroke;

  return (
    <div className={cn('flex flex-col items-center', className)} role="img" aria-label={`${label} : ${clamped} sur 100 (${colors.label})`}>
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} className="overflow-visible">
        <path
          d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
          fill="none"
          stroke={colors.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 600ms ease-out' }}
        />
        <text x={cx} y={cy - size * 0.02} textAnchor="middle" className="fill-[var(--color-foreground)] font-heading" style={{ fontSize: size * 0.22, fontWeight: 700 }}>
          {clamped}
        </text>
        <text x={cx} y={cy + size * 0.1} textAnchor="middle" className="fill-[var(--color-muted-foreground)]" style={{ fontSize: size * 0.07 }}>
          / 100
        </text>
      </svg>
      <span className={cn('mt-1 rounded-full px-3 py-0.5 text-xs font-semibold', colors.bg, colors.text)}>{colors.label}</span>
    </div>
  );
}
