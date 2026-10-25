import { X } from 'lucide-react';
import { NeedleMark, ProductImage } from './ui';
import './SearchProgress.css';

const tips = [
  'You can refine your find by color, style, or budget.',
  'Prices keep their original currency.',
  'Look for the source link in Product details.',
  'A closer crop helps focus on one object.',
];

export function SearchProgress({ image, elapsed, refining, onStop }: { image?: string | null; elapsed: number; refining: boolean; onStop: () => void }) {
  const headline = elapsed >= 30 ? 'This find needs a little longer…' : refining ? 'Looking for a better fit…' : 'Finding what caught your eye…';
  return <section className="find-progress" aria-label="Search in progress">
    <div className="find-progress-top">
      <span className="find-progress-label"><span className="activity-dot" aria-hidden="true" />Needle is looking</span>
      <span className="find-progress-time" aria-label={`${elapsed} seconds elapsed`}>{elapsed}s</span>
      <button className="icon-button" onClick={onStop} aria-label="Stop search"><X size={17} /></button>
    </div>
    <div className="find-progress-main">
      <div className="find-scan" aria-hidden="true">
        {image ? <ProductImage src={image} alt="" /> : <div className="find-scan-mark"><NeedleMark size={40} /></div>}
        <span className="find-scan-corners" /><span className="find-scan-line" />
      </div>
      <div className="find-progress-copy">
        <strong role="status">{headline}</strong>
        <p>{refining ? 'Your original selection stays in view.' : 'One detail can lead to a great find.'}</p>
        <span className="find-progress-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    </div>
    <p className="find-progress-tip" key={Math.floor(elapsed / 7)}>{tips[Math.floor(elapsed / 7) % tips.length]}</p>
  </section>;
}
