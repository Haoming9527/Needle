import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, MousePointer2 } from 'lucide-react';
import './styles.css';

function Demo() {
  return <>
    <a className="skip-link" href="#article">Skip to article</a>
    <header className="edit-header" id="top">
      <div className="masthead">
        <a href="#top" className="edit-brand" aria-label="The Everyday Edit home">The Everyday Edit<span>Objects, spaces, and the way we live.</span></a>
        <a className="companion-link" href="panel.html" target="_blank" rel="noreferrer">Open Needle <ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
      <nav className="section-nav" aria-label="In this story"><a href="#article">At home</a><a href="#listening">Listening</a><a href="#carry">Everyday carry</a><a href="#lighting">Objects</a><span>Sunday reading</span></nav>
    </header>
    <main id="article">
      <article>
        <header className="article-header">
          <p className="article-category">Spaces &amp; everyday rituals</p>
          <h1>A little space for a better day.</h1>
          <p className="article-deck">A quiet soundtrack, a well-packed bag, a pool of afternoon light. The small things that make a corner of home feel like your own.</p>
          <div className="article-meta"><span>By <strong>The Editors</strong></span><time dateTime="2026-10-25">October 25, 2026</time><span>4 minute read</span></div>
        </header>
        <aside className="needle-note" aria-label="Shop the objects in this story"><MousePointer2 size={18} aria-hidden="true" /><p>Something catch your eye? <strong>Right-click it with Needle.</strong></p><a href="panel.html" target="_blank" rel="noreferrer">Find it <ArrowUpRight size={14} aria-hidden="true" /></a></aside>
        <figure className="hero-photo">
          <img src="assets/photos/workspace.png" alt="A sunlit home workspace with black over-ear headphones, a white adjustable desk lamp, and an ochre canvas backpack" fetchPriority="high" />
          <figcaption>A place to begin, and a place to come back to.</figcaption>
        </figure>
        <div className="article-prose opening-copy">
          <p>There is a particular kind of calm in a room before the day gets going. The light is still moving across the desk. Nothing is open yet. For a moment, a small corner of an apartment can feel like all the space you need.</p>
          <p>It does not take a new room, or even a new desk, to hold on to a little of that feeling. Sometimes it is a few useful objects, placed where your hands naturally reach for them. These are the things we would make room for.</p>
        </div>
        <section className="object-story listening-story" id="listening" aria-labelledby="listening-title">
          <div className="story-copy">
            <p className="story-category">The morning ritual</p><h2 id="listening-title">A little less noise.</h2>
            <p>Before the inbox, a record. Before the next meeting, ten minutes with something worth listening to. A pair of over-ear headphones makes that small change of pace feel deliberate.</p>
            <p>We like the simplicity of a soft, padded headband and a quiet black finish. Rest them beside your notebook and they become a gentle cue: one thing at a time.</p>
            <p className="object-caption">In the picture: black wireless over-ear headphones.</p>
          </div>
          <figure className="object-photo headphones-photo"><img src="assets/photos/headphones.png" alt="Black wireless over-ear headphones with cushioned ear cups and a padded headband" loading="lazy" /><figcaption>A daily companion for a quieter moment.</figcaption></figure>
        </section>
        <section className="object-story carry-story" id="carry" aria-labelledby="carry-title">
          <figure className="object-photo carry-photo"><img src="assets/photos/bag.png" alt="Ochre canvas backpack with top handles, shoulder straps, and a front zip pocket" loading="lazy" /><figcaption>Ready for the walk, the train, and whatever comes after.</figcaption></figure>
          <div className="story-copy">
            <p className="story-category">Out into the day</p><h2 id="carry-title">Take just enough.</h2>
            <p>A notebook, a water bottle, the layer you will probably need later. Packing a bag is a small way of deciding what matters for the next few hours.</p>
            <p>Canvas brings a welcome bit of texture to the daily routine. The ochre colour is easy to spot by the door; the top handles make it just as easy to grab on the way out.</p>
            <aside className="editor-note"><h3>A note from the editors</h3><p>Keep one pocket empty. It is useful for the little things you find along the way.</p></aside>
          </div>
        </section>
        <section className="lighting-story" id="lighting" aria-labelledby="lighting-title">
          <div className="lighting-heading"><p className="story-category">The afternoon shift</p><h2 id="lighting-title">Good light changes the room.</h2></div>
          <figure className="lighting-photo"><img src="assets/photos/lamp.png" alt="White metal task lamp with an adjustable articulated arm casting light across a wooden desk" loading="lazy" /><figcaption>An adjustable desk lamp brings the light to whatever is in front of you.</figcaption></figure>
          <div className="article-prose closing-copy"><p>When the daylight starts to fade, a desk lamp can make the room feel smaller in the best possible way. The work surface becomes a place of its own, with the rest of the evening waiting just beyond it.</p><p>An articulated arm lets you move the light between a book, a page of notes, and the detail that needs a closer look. Nothing elaborate. Just enough to make staying a little longer feel good.</p><p>Perhaps that is the thread connecting all of these things. They do not ask you to do more. They make a little more room for the way you already want to spend your day.</p></div>
        </section>
        <div className="article-end"><span>From The Everyday Edit</span><a href="#top">Back to the story <ArrowUpRight size={15} aria-hidden="true" /></a></div>
      </article>
    </main>
    <footer className="edit-footer"><div><a className="footer-brand" href="#top">The Everyday Edit</a><p>A closer look at the things around us.</p></div><p className="editorial-disclosure">Fictional editorial demo. Images generated for this story. Purchases simulated.</p><a href="x-demo.html">Studio notes <ArrowUpRight size={15} aria-hidden="true" /></a></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Demo /></React.StrictMode>);
