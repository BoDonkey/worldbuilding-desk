/**
 * Another version of a model reply, and stepping between versions (Slice 4.73).
 * Only the version shown is kept; the caller discards the rest when the
 * author moves on. Each version is a full model run.
 */
export function ReplyVersionControls({
  count,
  index,
  busy,
  disabledReason,
  onShow,
  onAnother
}: {
  count: number;
  index: number;
  busy: boolean;
  /** Why another version cannot be asked for now; shown as the button's title. */
  disabledReason: string | null;
  onShow: (index: number) => void;
  onAnother: () => void;
}) {
  return (
    <div role='group' aria-label='Reply versions'>
      {count > 1 && (
        <>
          <button type='button' aria-label='Previous version' disabled={busy || index === 0} onClick={() => onShow(index - 1)}>
            ‹
          </button>
          <span aria-live='polite'>
            {' '}
            Version {index + 1} of {count}{' '}
          </span>
          <button
            type='button'
            aria-label='Next version'
            disabled={busy || index === count - 1}
            onClick={() => onShow(index + 1)}
          >
            ›
          </button>{' '}
        </>
      )}
      <button type='button' disabled={busy || Boolean(disabledReason)} title={disabledReason ?? undefined} onClick={onAnother}>
        Another version
      </button>
      {count > 1 && <small> Only the version shown is kept when you continue.</small>}
    </div>
  );
}
