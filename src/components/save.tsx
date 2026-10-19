import type { SaveState } from './autosave';
import { Icon } from './icons';

/**
 * The save indicator in the top bar. Visible at every width: "Saving..." while a request is out,
 * "Saved" only once the server has confirmed, and a plain warning while retries are going on.
 */
export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span className="eq-top__meta bp-save" data-state={state} aria-live="polite" role="status">
      {state === 'saving' && (
        <>
          <span className="bp-save__dot" aria-hidden="true" />
          Saving...
        </>
      )}
      {state === 'saved' && (
        <>
          <Icon name="saved" />
          Saved
        </>
      )}
      {state === 'retrying' && (
        <>
          <Icon name="clock" />
          <span className="bp-save__long">Not saved yet. We'll keep trying.</span>
          <span className="bp-save__short">Not saved yet</span>
        </>
      )}
      {state === 'expired' && (
        <>
          <Icon name="lock" />
          Signed out
        </>
      )}
      {state === 'locked' && (
        <>
          <Icon name="lock" />
          Sent
        </>
      )}
      {state === 'preview' && 'Preview only'}
      {state === 'idle' && (
        <>
          <Icon name="saved" />
          Autosave on
        </>
      )}
    </span>
  );
}
