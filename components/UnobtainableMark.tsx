/** The red "!" with its tooltip: what is unobtainable and, when known, why. */
export function UnobtainableMark({
  label,
  detail,
  focusable = false,
}: {
  label: string;
  detail?: string | null;
  focusable?: boolean;
}) {
  return (
    <i className="unob" role="img" tabIndex={focusable ? 0 : undefined} aria-label={detail ? `${label} ${detail}` : label}>
      !
      <span className="tip">
        <b>{label}</b>
        {detail && <span>{detail}</span>}
      </span>
    </i>
  );
}
