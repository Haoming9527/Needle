import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SearchProgress } from '../../src/panel/SearchProgress';
import '../../src/panel/styles.css';

function Preview() {
  const [started, setStarted] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running, started]);
  return <main style={{ maxWidth: 390, margin: '50px auto', padding: 20 }}>
    <h1 style={{ fontSize: 24 }}>A find in progress</h1>
    <p style={{ fontSize: 12, color: '#7b8598', marginTop: 10 }}>Development preview. The actual loading component is running without an API request.</p>
    {running ? <SearchProgress image="/assets/photos/headphones.png" elapsed={elapsed} refining={false} onStop={() => setRunning(false)} /> : <p style={{ margin: '24px 0' }}>Search stopped.</p>}
    <button className="secondary-button" onClick={() => { setElapsed(0); setStarted(Date.now()); setRunning(true); }}>Restart preview</button>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
