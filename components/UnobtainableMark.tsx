/** The red "!" with its tooltip: what is unobtainable and, when known, why. */
export function UnobtainableMark({ label, detail }: { label: string; detail?: string | null }) {
  return (
    <i className="unob" role="img" aria-label={detail ? `${label} ${detail}` : label}>
      !
      <span className="tip">
        <b>{label}</b>
        {detail && <span>{detail}</span>}
      </span>
    </i>
  );
}
