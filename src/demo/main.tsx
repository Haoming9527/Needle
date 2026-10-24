import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, MousePointer2, Scissors } from 'lucide-react';
import './styles.css';

const finds = [
  { title: 'A softer soundtrack.', category: 'For the commute', description: 'A quiet corner, wherever the day takes you.', alt: 'Sony WH-1000XM5 black wireless over-ear headphones', image: 'headphones', number: '01' },
  { title: 'Room for the everyday.', category: 'For the journey', description: 'A good companion for all the little things.', alt: 'Fjallraven Kanken blue everyday backpack', image: 'bag', number: '02' },
  { title: 'A brighter little corner.', category: 'For the desk', description: 'Make space for the things you love doing.', alt: 'IKEA TERTIAL adjustable desk lamp', image: 'lamp', number: '03' },
];

function Demo() {
  return <>
    <header className="edit-header"><a href="#" aria-label="The Everyday Edit home" className="edit-brand"><span className="brand-square" />The Everyday Edit</a><a href="x-demo.html" className="preview-link">Try the X video interaction <ArrowUpRight size={17}/></a></header>
    <main>
      <section className="edit-intro"><div><p className="edition">A collection for the everyday</p><h1>Good things,<br/>found along the way.</h1><p className="intro-copy">A few thoughtful objects for the places you go<br className="desktop-break"/> and the spaces you come home to.</p></div><aside className="needle-tip"><MousePointer2 size={22}/><strong>Something catch your eye?</strong><p>Right-click an image. Needle finds the item, ready to buy or save to your cart.</p><span>Use the unpacked Needle extension on this page.</span></aside></section>
      <section className="finds" aria-label="Three inspiration objects">{finds.map(find => <article className="find" key={find.image}><div className="find-picture"><img src={`assets/${find.image}.svg`} alt={find.alt}/><span className="find-number">{find.number}</span></div><p className="find-category">{find.category}</p><h2>{find.title}</h2><p>{find.description}</p></article>)}</section>
      <section className="scene-section"><div className="scene-copy"><Scissors size={22}/><h2>One scene.<br/>A few possibilities.</h2><p>Right-click this scene, then crop the object you want in Needle. You decide what the agent should look for.</p><span>In sample mode, describe your crop as headphones, a backpack, or a desk lamp.</span></div><img src="assets/scene.svg" alt="Desk scene with several objects; crop one item to search"/></section>
    </main>
    <footer><span>The Everyday Edit</span><p>A fictional inspiration page for the Needle demonstration. All artwork is illustrative. This page does not sell products.</p><a href="panel.html">Try the shopping companion <ArrowUpRight size={16}/></a></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Demo/></React.StrictMode>);
