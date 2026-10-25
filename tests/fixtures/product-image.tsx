import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductImage } from '../../src/panel/components/ui';

function Fixture() {
  const [selected, setSelected] = useState('/assets/photos/headphones.png');
  return <main>
    <style>{`body{margin:0;background:#f4f6fa;color:#20242c;font:14px/1.5 system-ui}main{max-width:820px;margin:28px auto;padding:20px}h1{margin:0 0 8px;font-size:24px}p{color:#657080}button{padding:10px 14px;background:#3156e8;color:white;border:0;border-radius:8px;cursor:pointer}.cases{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:20px}section{background:white;padding:16px;border:1px solid #dce2eb;border-radius:12px}h2{font-size:15px;margin:0 0 12px}.product-image{height:160px;display:grid;place-items:center;background:#f5f7fa;border-radius:8px}.product-image img{width:100%;height:160px;object-fit:contain}@media(max-width:500px){.cases{grid-template-columns:1fr}}`}</style>
    <h1>Selected-image fallback</h1>
    <p>Development fixture using the real ProductImage component. Missing or broken product photos use the selected image; a working product photo remains unchanged.</p>
    <button onClick={() => setSelected(value => value.includes('headphones') ? '/assets/photos/bag.png' : '/assets/photos/headphones.png')}>Change selected image</button>
    <div className="cases">
      <section id="missing-photo"><h2>Missing product photo</h2><ProductImage src={null} fallbackSrc={selected} alt="Product without a photo" /></section>
      <section id="broken-photo"><h2>Broken product photo</h2><ProductImage src="/tests/fixtures/missing-product.png" fallbackSrc={selected} alt="Product with a broken photo" /></section>
      <section id="working-photo"><h2>Working product photo</h2><ProductImage src="/assets/photos/lamp.png" fallbackSrc={selected} alt="Product lamp" /></section>
      <section id="both-broken"><h2>Both images fail: no error text or loop</h2><ProductImage src="/tests/fixtures/missing-both.png" fallbackSrc="/tests/fixtures/missing-selection.png" alt="Product with no usable image" /></section>
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
