import React from 'react';
import { createRoot } from 'react-dom/client';
import './x-preview.css';

function XPreview() {
  return <main className="feed"><header><a href="demo.html">← Inspiration</a><a href="panel.html" target="_blank" rel="noreferrer">Open Needle</a></header><h1>Shop what catches your eye.</h1><p className="hint">Right-click the microphone in this video frame. Needle will search the area around your cursor.</p><article data-testid="tweet"><div className="author"><span className="avatar">S</span><div><b>Studio notes</b><span>@studio_example · illustrated post</span></div></div><p data-testid="tweetText">A small podcast setup. A black broadcast microphone, an adjustable boom arm, and a laptop.</p><video aria-label="Illustrated podcast video frame with a microphone, boom arm and laptop" poster="/assets/podcast.svg" playsInline controls preload="none"/><div className="post-bottom">This is a local interaction fixture, not X. No account or social actions are connected.</div></article><section><h2>Try an image, too</h2><img src="/assets/microphone.svg" alt="Shure MV7 podcast microphone black"/><p>Right-click the image to find this microphone in the sample catalog.</p></section><footer>The unpacked extension must be loaded and this tab refreshed after an extension update. On X, use the same gesture on a photo or video.</footer></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><XPreview/></React.StrictMode>);
