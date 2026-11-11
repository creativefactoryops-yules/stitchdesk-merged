import { useState } from 'react';
import { RENDER_LABEL } from '../../shared/render';

/** An AI image, always labelled "AI preview, final may vary." Handles slow or failed loads. */
export function RenderImage({ url, alt, note }: { url: string; alt: string; note?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  return (
    <figure className="render">
      {state === 'loading' && <p role="status">Painting the preview. This can take 10 to 30 seconds…</p>}
      {state === 'error' && (
        <p role="alert" className="error">
          The image service did not answer. Try again in a minute.
        </p>
      )}
      <img
        src={url}
        alt={alt}
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
        style={state === 'error' ? { display: 'none' } : undefined}
      />
      <figcaption>
        {RENDER_LABEL}
        {note ? ` ${note}` : ''}
      </figcaption>
    </figure>
  );
}
