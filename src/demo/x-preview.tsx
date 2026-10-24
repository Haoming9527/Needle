import React from 'react';
import { createRoot } from 'react-dom/client';
import './x-preview.css';

function XPreview() {
  return <main className="feed"><header><a href="demo.html">← The Everyday Edit</a><a href="panel.html" target="_blank" rel="noreferrer">Open Needle</a></header><h1>Shop what catches your eye.</h1><p className="hint">Right-click the microphone in this video frame. Needle will search the area around your cursor.</p><article data-testid="tweet"><div className="author"><span className="avatar">S</span><div><b>Studio notes</b><span>@studio_example · A quiet Sunday in the studio</span></div></div><p data-testid="tweetText">A small podcast setup. A black broadcast microphone, an adjustable boom arm, and a laptop.</p><video aria-label="Podcast setup with a black microphone, boom arm and silver laptop" poster="assets/photos/podcast.png" playsInline controls preload="none"/><div className="post-bottom">Local interaction fixture with generated photography. No social account is connected.</div></article><section><h2>The recording corner</h2><img src="assets/photos/podcast.png" alt="Black broadcast microphone with a foam windscreen on an adjustable boom arm"/><p>Right-click the object that catches your eye.</p></section><footer>The unpacked extension must be loaded and this tab refreshed after an extension update. On X, use the same gesture on a photo or video.</footer></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><XPreview/></React.StrictMode>);
