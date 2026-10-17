import { useI18n } from '../lib/i18n'

const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * How far along tonight is, and the household's streak - the top of the
 * Tonight screen. The ring is water blue: it fills as the plants get water.
 */
export function TonightProgress({ watered, total, streak }: { watered: number; total: number; streak: number | null }) {
  const { t } = useI18n()
  const left = total - watered
  const share = total > 0 ? watered / total : 0
  const details = [left > 0 ? t.tonight.progressLeft(left) : t.tonight.progressDone]
  // One day is not a streak yet.
  if (streak !== null && streak >= 2) details.push(t.tonight.streak(streak))

  return (
    <section className="tonight-progress">
      <svg className="tonight-progress-ring" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={RADIUS} fill="none" className="tonight-progress-track" strokeWidth="7" />
        <circle
          cx="28"
          cy="28"
          r={RADIUS}
          fill="none"
          className="tonight-progress-fill"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
          transform="rotate(-90 28 28)"
        />
        <text x="28" y="33" textAnchor="middle" direction="ltr" className="tonight-progress-count">
          {`${watered}/${total}`}
        </text>
      </svg>
      <div className="tonight-progress-text">
        <p className="tonight-progress-title">{t.tonight.progress(watered, total)}</p>
        <p className="tonight-progress-details">{details.join(' · ')}</p>
      </div>
    </section>
  )
}
