import * as React from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";

const tourSteps = {
  shopper: [
    {
      target: `account`,
      title: `One Google account. All your finds.`,
      description: `Preview how the same Google account connects your Needle extension with your personal space.`,
    },
    {
      target: `library`,
      title: `Every find, in one place.`,
      description: `The products you searched with the extension live here. Open a card to revisit the product and the moment behind it.`,
    },
    {
      target: `filters`,
      title: `Find your kind of thing.`,
      description: `Use search and categories to narrow the library to what you have in mind.`,
    },
    {
      target: `collections`,
      title: `Keep the good finds together.`,
      description: `Collections give your saved products a home, from everyday essentials to your next big idea.`,
    },
    {
      target: `extension-demo`,
      title: `See how a find becomes yours.`,
      description: `Close the tour to watch Needle find an item after a right-click and add it to a cart. You can replay the example any time.`,
    },
  ],
  seller: [
    {
      target: `seller-overview`,
      title: `Your shop, at a glance.`,
      description: `Start with a quick overview of product interest and the example signals in this demo.`,
    },
    {
      target: `seller-products`,
      title: `Put your products in focus.`,
      description: `Review your product list and compare where shoppers are showing interest.`,
    },
    {
      target: `seller-reasons`,
      title: `See what resonates.`,
      description: `Explore the reasons shoppers selected, from price and design to comfort and convenience.`,
    },
    {
      target: `seller-creators`,
      title: `Find a promising connection.`,
      description: `Explore example creator matches and see why each could suit a product.`,
    },
  ],
};

const seenTours = /* @__PURE__ */ new Set();

const tourStorageKey = (e2) => `needle.portal.guided-tour.v1.${e2}`;

const clamp = (e2, t2, n2) => Math.max(t2, Math.min(e2, Math.max(t2, n2)));

function findTourTarget(e2) {
  let t2 = document.querySelector(`[data-tour="${e2.target}"]`);
  return t2 &&
    t2.getClientRects().length &&
    getComputedStyle(t2).visibility !== `hidden`
    ? t2
    : null;
}

function viewportBounds() {
  let e2 = window.visualViewport;
  return {
    left: e2?.offsetLeft ?? 0,
    top: e2?.offsetTop ?? 0,
    width: e2?.width ?? window.innerWidth,
    height: e2?.height ?? window.innerHeight,
  };
}

function hasSeenTour(e2) {
  try {
    return (
      seenTours.has(e2) || localStorage.getItem(tourStorageKey(e2)) === `seen`
    );
  } catch {
    return seenTours.has(e2);
  }
}

function GuidedTour({ view: e2, startKey: t2, onClose: n2, onActiveTargetChange }) {
  let [r2, i2] = (0, React.useState)(null),
    [a2, o2] = (0, React.useState)(null),
    [s2, c2] = (0, React.useState)(() => viewportBounds()),
    [l2, d2] = (0, React.useState)({ width: 358, height: 246 }),
    [f2, p2] = (0, React.useState)(false),
    m2 = (0, React.useRef)(null),
    h2 = (0, React.useRef)(null),
    g2 = (0, React.useRef)(null),
    _2 = (0, React.useRef)(r2);
  _2.current = r2;
  let v2 = (0, React.useRef)(n2);
  v2.current = n2;
  let y2 = (0, React.useRef)(null),
    b2 = (0, React.useRef)(t2),
    x2 = (0, React.useId)().replace(/:/g, ``),
    S2 = r2 !== null,
    C2 = (0, React.useCallback)((e3) => {
      let t3 = tourSteps[e3].filter((e4) => findTourTarget(e4));
      t3.length &&
        (_2.current ||
          (y2.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null),
        o2(null),
        i2({ view: e3, steps: t3, index: 0 }));
    }, []),
    w2 = (0, React.useCallback)(() => {
      let e3 = _2.current;
      if (e3) {
        seenTours.add(e3.view);
        try {
          localStorage.setItem(tourStorageKey(e3.view), `seen`);
        } catch {}
        (i2(null), o2(null), v2.current?.());
      }
    }, []),
    T2 = (0, React.useCallback)(
      (e3) => {
        let t3 = _2.current;
        if (!t3) return;
        let n3 = t3.index + e3;
        for (
          ;
          n3 >= 0 && n3 < t3.steps.length && !findTourTarget(t3.steps[n3]);
        )
          n3 += e3;
        n3 >= t3.steps.length ? w2() : n3 >= 0 && i2({ ...t3, index: n3 });
      },
      [w2],
    );
  React.useEffect(() => {
    onActiveTargetChange?.(r2?.steps[r2.index]?.target ?? null);
  }, [r2, onActiveTargetChange]);

  if (
    ((0, React.useEffect)(() => {
      let e3 = window.matchMedia(`(prefers-reduced-motion: reduce)`),
        t3 = () => p2(e3.matches);
      return (
        t3(),
        e3.addEventListener(`change`, t3),
        () => e3.removeEventListener(`change`, t3)
      );
    }, []),
    (0, React.useEffect)(() => {
      (i2(null), o2(null));
      let t3 = window.setTimeout(() => {
        !_2.current && !hasSeenTour(e2) && C2(e2);
      }, 120);
      return () => window.clearTimeout(t3);
    }, [e2, C2]),
    (0, React.useEffect)(() => {
      b2.current !== t2 && ((b2.current = t2), C2(e2));
    }, [t2, e2, C2]),
    (0, React.useEffect)(() => {
      if (!S2) return;
      let e3 = h2.current;
      if (!e3) return;
      let t3 = [...document.body.children].filter(
          (e4) => e4 instanceof HTMLElement && e4 !== m2.current,
        ),
        n3 = t3.map((e4) => ({ element: e4, inert: e4.inert })),
        r3 = requestAnimationFrame(() =>
          g2.current?.focus({ preventScroll: true }),
        );
      t3.forEach((e4) => {
        e4.inert = true;
      });
      let i3 = () =>
          [
            ...e3.querySelectorAll(
              `button:not(:disabled), a[href], [tabindex="0"]`,
            ),
          ].filter((e4) => e4.getClientRects().length),
        a3 = (t4) => {
          e3.contains(t4.target) ||
            (g2.current ?? e3).focus({ preventScroll: true });
        },
        o3 = (t4) => {
          if (t4.key === `Escape`) (t4.preventDefault(), w2());
          else if (t4.key === `ArrowRight`) (t4.preventDefault(), T2(1));
          else if (t4.key === `ArrowLeft`) (t4.preventDefault(), T2(-1));
          else if (t4.key === `Tab`) {
            let n4 = i3(),
              r4 = n4[0],
              a4 = n4.at(-1);
            if (!r4 || !a4) {
              (t4.preventDefault(), e3.focus({ preventScroll: true }));
              return;
            }
            t4.shiftKey &&
            (document.activeElement === r4 || document.activeElement === e3)
              ? (t4.preventDefault(), a4.focus({ preventScroll: true }))
              : !t4.shiftKey &&
                document.activeElement === a4 &&
                (t4.preventDefault(), r4.focus({ preventScroll: true }));
          }
        };
      return (
        document.addEventListener(`keydown`, o3, true),
        document.addEventListener(`focusin`, a3, true),
        () => {
          (cancelAnimationFrame(r3),
            document.removeEventListener(`keydown`, o3, true),
            document.removeEventListener(`focusin`, a3, true),
            n3.forEach(({ element: e5, inert: t4 }) => {
              e5.inert = t4;
            }));
          let e4 = y2.current;
          e4?.isConnected &&
            !e4.hasAttribute(`disabled`) &&
            e4.focus({ preventScroll: true });
        }
      );
    }, [S2, w2, T2]),
    (0, React.useLayoutEffect)(() => {
      if (!r2) return;
      let e3 = r2.steps[r2.index],
        t3 = findTourTarget(e3);
      if (!t3) {
        let e4 = r2.steps.findIndex(
          (e5, t4) => t4 > r2.index && findTourTarget(e5),
        );
        e4 >= 0 ? i2({ ...r2, index: e4 }) : w2();
        return;
      }
      t3.scrollIntoView({
        behavior: f2 ? `instant` : `smooth`,
        block: `center`,
        inline: `nearest`,
      });
      let n3 = 0,
        a3 = () => {
          if (((n3 = 0), !t3.isConnected || !t3.getClientRects().length)) {
            o2(null);
            return;
          }
          let e4 = viewportBounds(),
            r3 = t3.getBoundingClientRect(),
            i3 = clamp(r3.left - 7, e4.left + 6, e4.left + e4.width - 6),
            a4 = clamp(r3.top - 7, e4.top + 6, e4.top + e4.height - 6),
            s4 = clamp(r3.right + 7, e4.left + 6, e4.left + e4.width - 6),
            l4 = clamp(r3.bottom + 7, e4.top + 6, e4.top + e4.height - 6);
          (c2(e4),
            o2(
              s4 > i3 && l4 > a4
                ? { left: i3, top: a4, width: s4 - i3, height: l4 - a4 }
                : null,
            ));
          let u2 = h2.current?.getBoundingClientRect();
          u2 &&
            d2((e5) =>
              Math.abs(e5.width - u2.width) > 0.5 ||
              Math.abs(e5.height - u2.height) > 0.5
                ? { width: u2.width, height: u2.height }
                : e5,
            );
        },
        s3 = () => {
          n3 ||= requestAnimationFrame(a3);
        };
      s3();
      let l3 = new ResizeObserver(s3);
      return (
        l3.observe(t3),
        h2.current && l3.observe(h2.current),
        window.addEventListener(`scroll`, s3, true),
        window.addEventListener(`resize`, s3),
        window.visualViewport?.addEventListener(`resize`, s3),
        window.visualViewport?.addEventListener(`scroll`, s3),
        () => {
          (cancelAnimationFrame(n3),
            l3.disconnect(),
            window.removeEventListener(`scroll`, s3, true),
            window.removeEventListener(`resize`, s3),
            window.visualViewport?.removeEventListener(`resize`, s3),
            window.visualViewport?.removeEventListener(`scroll`, s3));
        }
      );
    }, [r2, f2, w2]),
    !r2 || typeof document > `u`)
  )
    return null;
  let ee2 = r2.steps[r2.index],
    E2 = r2.index === r2.steps.length - 1,
    D2 = Math.min(358, s2.width - 24),
    O2 = a2 ? a2.left + (a2.width - D2) / 2 : s2.left + (s2.width - D2) / 2,
    k2 = s2.top + (s2.height - l2.height) / 2,
    A2 = `floating`;
  if (a2) {
    let e3 = a2.top + a2.height;
    e3 + 18 + l2.height < s2.top + s2.height - 12
      ? ((k2 = e3 + 18), (A2 = `below`))
      : a2.top - 18 - l2.height > s2.top + 12
        ? ((k2 = a2.top - 18 - l2.height), (A2 = `above`))
        : (k2 = s2.top + s2.height - l2.height - 12);
  }
  ((O2 = clamp(O2, s2.left + 12, s2.left + s2.width - D2 - 12)),
    (k2 = clamp(k2, s2.top + 12, s2.top + s2.height - l2.height - 12)));
  let j2 = a2 ? clamp(a2.left + a2.width / 2 - O2, 26, D2 - 26) : D2 / 2;
  return (0, ReactDOM.createPortal)(
    (0, jsxRuntime.jsxs)(`div`, {
      ref: m2,
      className: `needle-tour ${f2 ? `needle-tour--reduced` : ``}`,
      children: [
        (0, jsxRuntime.jsxs)(`svg`, {
          className: `needle-tour-shade`,
          "aria-hidden": `true`,
          width: `100%`,
          height: `100%`,
          children: [
            (0, jsxRuntime.jsx)(`defs`, {
              children: (0, jsxRuntime.jsxs)(`mask`, {
                id: `needle-tour-mask-${x2}`,
                maskUnits: `userSpaceOnUse`,
                x: `0`,
                y: `0`,
                width: `100%`,
                height: `100%`,
                children: [
                  (0, jsxRuntime.jsx)(`rect`, {
                    x: `0`,
                    y: `0`,
                    width: `100%`,
                    height: `100%`,
                    fill: `white`,
                  }),
                  a2 &&
                    (0, jsxRuntime.jsx)(`rect`, {
                      className: `needle-tour-cutout`,
                      x: a2.left,
                      y: a2.top,
                      width: a2.width,
                      height: a2.height,
                      rx: `15`,
                      fill: `black`,
                    }),
                ],
              }),
            }),
            (0, jsxRuntime.jsx)(`rect`, {
              x: `0`,
              y: `0`,
              width: `100%`,
              height: `100%`,
              fill: `rgba(14, 28, 39, .70)`,
              mask: `url(#needle-tour-mask-${x2})`,
            }),
          ],
        }),
        a2 &&
          (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
            children: [
              (0, jsxRuntime.jsx)(`div`, {
                className: `needle-tour-ring`,
                "aria-hidden": `true`,
                style: {
                  left: a2.left,
                  top: a2.top,
                  width: a2.width,
                  height: a2.height,
                },
              }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `needle-tour-number`,
                "aria-hidden": `true`,
                style: {
                  left: clamp(
                    a2.left + 12,
                    s2.left + 10,
                    s2.left + s2.width - 44,
                  ),
                  top: Math.max(s2.top + 8, a2.top - 17),
                },
                children: r2.index + 1,
              }),
            ],
          }),
        (0, jsxRuntime.jsxs)(`div`, {
          ref: h2,
          className: `needle-tour-card`,
          role: `dialog`,
          "aria-modal": `true`,
          "aria-labelledby": `${x2}-title`,
          "aria-describedby": `${x2}-description`,
          tabIndex: -1,
          "data-placement": A2,
          style: {
            left: O2,
            top: k2,
            width: D2,
            maxHeight: Math.max(130, s2.height - 24),
          },
          children: [
            A2 !== `floating` &&
              (0, jsxRuntime.jsx)(`span`, {
                className: `needle-tour-arrow`,
                "aria-hidden": `true`,
                style: { left: j2 },
              }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `needle-tour-topline`,
              children: [
                (0, jsxRuntime.jsx)(`span`, {
                  children:
                    r2.view === `shopper`
                      ? `YOUR NEEDLE, A QUICK TOUR`
                      : `YOUR SELLER SPACE`,
                }),
                (0, jsxRuntime.jsx)(`button`, {
                  className: `needle-tour-close`,
                  type: `button`,
                  onClick: w2,
                  "aria-label": `Close tour`,
                  children: (0, jsxRuntime.jsx)(`span`, {
                    "aria-hidden": `true`,
                    children: `\xD7`,
                  }),
                }),
              ],
            }),
            (0, jsxRuntime.jsxs)(
              `div`,
              {
                className: `needle-tour-copy`,
                "aria-live": `polite`,
                "aria-atomic": `true`,
                children: [
                  (0, jsxRuntime.jsx)(`h2`, {
                    id: `${x2}-title`,
                    children: ee2.title,
                  }),
                  (0, jsxRuntime.jsx)(`p`, {
                    id: `${x2}-description`,
                    children: ee2.description,
                  }),
                ],
              },
              `${r2.view}-${r2.index}`,
            ),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `needle-tour-progress`,
              children: [
                (0, jsxRuntime.jsxs)(`span`, {
                  children: [`Step `, r2.index + 1, ` of `, r2.steps.length],
                }),
                (0, jsxRuntime.jsx)(`div`, {
                  className: `needle-tour-dots`,
                  "aria-label": `Tour progress`,
                  children: r2.steps.map((e3, t3) =>
                    (0, jsxRuntime.jsx)(
                      `button`,
                      {
                        type: `button`,
                        className: t3 === r2.index ? `is-current` : ``,
                        "aria-current": t3 === r2.index ? `step` : void 0,
                        "aria-label": `Go to step ${t3 + 1}: ${e3.title}`,
                        onClick: () => i2({ ...r2, index: t3 }),
                      },
                      e3.target,
                    ),
                  ),
                }),
              ],
            }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `needle-tour-actions`,
              children: [
                (0, jsxRuntime.jsx)(`button`, {
                  className: `needle-tour-skip`,
                  type: `button`,
                  onClick: w2,
                  children: `Skip tour`,
                }),
                (0, jsxRuntime.jsxs)(`div`, {
                  children: [
                    (0, jsxRuntime.jsx)(`button`, {
                      className: `needle-tour-back`,
                      type: `button`,
                      onClick: () => T2(-1),
                      disabled: r2.index === 0,
                      children: `Back`,
                    }),
                    (0, jsxRuntime.jsxs)(`button`, {
                      ref: g2,
                      className: `needle-tour-next`,
                      type: `button`,
                      onClick: () => (E2 ? w2() : T2(1)),
                      children: [
                        E2 ? `Done` : `Next`,
                        (0, jsxRuntime.jsx)(`span`, {
                          "aria-hidden": `true`,
                          children: E2 ? `\u2713` : `\u2192`,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    document.body,
  );
}

export {
  tourSteps,
  seenTours,
  tourStorageKey,
  clamp,
  findTourTarget,
  viewportBounds,
  hasSeenTour,
  GuidedTour,
};
