import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import App from '../src/panel/App';

it('starts on Find with optional context navigation and shopping controls', () => {
  const html = renderToStaticMarkup(createElement(App));
  expect(html).toContain('Shop what you see.');
  expect(html).toMatch(/aria-current="page"[^>]*>.*?Find<\/button>/);
  expect(html).toContain('Discover</button>');
  expect(html).toContain('Saved</button>');
  expect(html).not.toContain('Read the controlled demo sources');
});
