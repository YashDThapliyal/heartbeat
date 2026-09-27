/** A quiet live counter: "● 1,234 visits". Hidden until a count is available. */
import { formatVisits, useVisits } from '../hooks/useVisits';

export function VisitCount({ className = '' }: { className?: string }) {
  const visits = useVisits();
  if (visits === null) return null;
  return (
    <span className={`visit-count ${className}`} title="Visits to this site, updating live">
      <span className="visit-dot" aria-hidden="true" />
      {formatVisits(visits)}
    </span>
  );
}
