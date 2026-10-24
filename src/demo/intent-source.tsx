import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEMO_ATTENTION_SOURCES } from '../../shared/attention';
import { mountAttentionCapture } from '../attention/client';
import { apiRequest } from '../panel/api';
import './intent-source.css';

type Status = { phase: 'paused' | 'ready' | 'tracking' | 'recorded' | 'error'; message: string; observationCount: number };
function SourcePage() {
  const recipe = location.pathname.endsWith('/recipe-demo.html');
  const source = DEMO_ATTENTION_SOURCES[recipe ? 'recipe-guide' : 'commute-guide'];
  const [status, setStatus] = useState<Status>({ phase: 'paused', message: 'Checking your local attention preferences…', observationCount: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => mountAttentionCapture({ onStatus: setStatus }), []);
  async function setEnabled(enabled: boolean) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (enabled) await apiRequest('/intent/consent', { enabled: true }, AbortSignal.timeout(8000));
      await apiRequest('/intent/attention/consent', { enabled }, AbortSignal.timeout(8000));
      window.dispatchEvent(new Event('needle-attention-consent'));
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Your preference could not be saved.'); }
    finally { setBusy(false); }
  }
  return <div className="attention-page"><a className="attention-skip" href="#reading">Skip to article</a>
    <header className="attention-header"><a href="panel.html">needle<span>Everyday discoveries</span></a><span className="attention-chip">Controlled demo</span></header>
    <aside className="attention-control" aria-label="Cursor attention controls"><div className="attention-control-copy"><strong>Real attention timing. Prepared demo context.</strong><p>With permission, Needle measures pauses over the marked reading region. This article and its topic labels are prepared demo material. Navigation clicks do not create observations.</p></div><div className="attention-buttons"><button disabled={busy} onClick={() => void setEnabled(true)}>Enable cursor attention</button><button className="attention-secondary" disabled={busy} onClick={() => void setEnabled(false)}>Pause cursor attention</button></div>{error && <p className="attention-error" role="alert">{error}</p>}</aside>
    <div className={`attention-status attention-status-${status.phase}`} role="status" aria-live="polite"><i aria-hidden="true"/><div><strong>{source.title}</strong><span>{status.message}</span></div><small>{status.observationCount} measured sources</small>{status.phase === 'error' && <button className="attention-secondary" onClick={() => window.dispatchEvent(new Event('needle-attention-retry'))}>Retry recording</button>}</div>
    <main><div className="attention-editorial"><p>{recipe ? 'The Sunday kitchen' : 'A slower start'} · Everyday notes</p><h1>{recipe ? 'A little preparation.\nA lighter weekday.' : 'The everyday ride,\nmade a little easier.'}</h1><span>Fictional editorial · {recipe ? 'recipes' : 'commuting'} source</span></div>
      <article id="reading" className={`attention-reading ${recipe ? 'attention-food' : 'attention-ride'}`} data-needle-attention-target={source.targetId} aria-labelledby="reading-title">
        <div className="attention-reading-label"><span>Measured reading region</span><small>Pause your pointer here to contribute an opted-in observation.</small></div>
        <div className="attention-art" aria-hidden="true">{recipe ? <><i/><i/><i/></> : <><i/><i/></>}</div>
        <div className="attention-prose"><h2 id="reading-title">{recipe ? 'Three lunches you can prepare on Sunday' : 'Making your weekday bike commute easier'}</h2><p>{recipe ? 'Roast a tray of vegetables while a pot of your favourite grain cooks. Mix a dressing, wash a handful of greens, and leave a little room to improvise during the week.' : 'Try a quieter route before the working week begins. Notice the junctions, the sheltered stretches, and the places where you can slow down without feeling rushed.'}</p><p>{recipe ? 'A bowl of rice, chickpeas and roasted vegetables can become several different lunches. Keep the dressing separate, vary the finishing touches, and plan only as much as feels helpful.' : 'Check the forecast, lay out a comfortable layer, and think about what you need to carry. Leaving a little earlier can make the ride feel like part of your day rather than a race to the next thing.'}</p><blockquote>{recipe ? 'Prepare a little today. Give yourself more time tomorrow.' : 'Pack lightly. Find a route you enjoy. Leave room to arrive calmly.'}</blockquote><p>{recipe ? 'The aim is a simpler lunch break, wherever you spend it. You might eat at home, take a break outdoors, or bring something with you. There is no single right routine.' : 'A commute can be practical and enjoyable at the same time. Start with one day a week, learn what feels comfortable, and adjust the routine as you go.'}</p></div>
      </article>
      <nav className="attention-next" aria-label="Continue the browsing story"><p>{recipe ? 'Next, explore a different everyday interest.' : 'Return to Needle to review the recorded clues and any tentative connection.'}</p><a href={recipe ? 'commute-demo.html' : 'panel.html'}>{recipe ? 'Read the commuting guide' : 'Review the connection in Needle'} →</a>{!recipe && <a className="attention-return" href="recipe-demo.html">Back to the recipe guide</a>}</nav>
    </main><footer>Measured cursor timing is a clue, not proof of interest or purchase intent. These two controlled demo sources share a local origin; their prepared source identities remain visible.</footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<SourcePage />);
