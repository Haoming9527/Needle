import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { products, categories, categoryLabels } from "./data/products.js";
import {
  PlayIcon,
  LinkIcon,
  GridIcon,
  DashboardIcon,
  ChevronDownIcon,
  HistoryIcon,
  BookmarkIcon,
  ShoppingBagIcon,
  ChartColumnIcon,
  HeartIcon,
  MonitorIcon,
  CheckCheckIcon,
  ArrowUpRightIcon,
  SparklesIcon,
  SearchIcon,
  CloseIcon,
  ArrowDownUpIcon,
  ClockIcon,
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
} from "./icons.js";
import { SellerStudio } from "./components/SellerStudio.jsx";
import { GuidedTour } from "./components/GuidedTour.jsx";
import { ExtensionDemo } from "./components/ExtensionDemo.jsx";

function initialWorkspace() {
  return window.location.hash === `#seller` ? `seller` : `shopper`;
}

function initialSavedProducts() {
  try {
    let e2 = JSON.parse(localStorage.getItem(`needle.demo.saved.v2`) || `null`);
    return Array.isArray(e2) && e2.every((e3) => typeof e3 == `string`)
      ? e2
      : products.slice(0, 3).map((e3) => e3.id);
  } catch {
    return products.slice(0, 3).map((e2) => e2.id);
  }
}

function formatProductPrice(e2) {
  return new Intl.NumberFormat(`en-US`, {
    style: `currency`,
    currency: e2.currency,
    maximumFractionDigits: 0,
  }).format(e2.price);
}

function GoogleMark() {
  return (0, jsxRuntime.jsx)(`span`, {
    className: `google-mark`,
    "aria-hidden": `true`,
    children: `G`,
  });
}

function SourceIcon({ source: e2 }) {
  return (0, jsxRuntime.jsx)(`span`, {
    className: `source-icon source-${e2.toLowerCase()}`,
    children:
      e2 === `YouTube`
        ? (0, jsxRuntime.jsx)(PlayIcon, { size: 10, fill: `currentColor` })
        : e2 === `Instagram`
          ? `\u25CE`
          : e2 === `TikTok`
            ? `\u266A`
            : (0, jsxRuntime.jsx)(LinkIcon, { size: 11 }),
  });
}

function NeedleApp() {
  const [tourTarget, setTourTarget] = React.useState(null);
  let [e2, t2] = (0, React.useState)(initialWorkspace),
    [n2, r2] = (0, React.useState)(() => {
      try {
        return localStorage.getItem(`needle.portal.lang`) === `ko`
          ? `ko`
          : `en`;
      } catch {
        return `en`;
      }
    }),
    [i2, a2] = (0, React.useState)(initialSavedProducts),
    [o2, s2] = (0, React.useState)(`all`),
    [c2, l2] = (0, React.useState)(`All`),
    [d2, f2] = (0, React.useState)(``),
    [p2, m2] = (0, React.useState)(`recent`),
    [T2, O2] = (0, React.useState)(null),
    [j2, M2] = (0, React.useState)(false),
    [ne2, ie2] = (0, React.useState)(0),
    [R2, z2] = (0, React.useState)(``),
    B2 = (0, React.useRef)(null),
    V2 = (0, React.useRef)(null),
    H2 = (e3, t3) => (n2 === `en` ? e3 : t3);
  ((0, React.useEffect)(() => {
    let e3 = () => t2(initialWorkspace());
    return (
      window.addEventListener(`hashchange`, e3),
      () => window.removeEventListener(`hashchange`, e3)
    );
  }, []),
    (0, React.useEffect)(() => {
      document.documentElement.lang = n2;
      try {
        localStorage.setItem(`needle.portal.lang`, n2);
      } catch {}
    }, [n2]),
    (0, React.useEffect)(() => {
      try {
        localStorage.setItem(`needle.demo.saved.v2`, JSON.stringify(i2));
      } catch {}
    }, [i2]),
    (0, React.useEffect)(() => {
      T2 && B2.current && !B2.current.open && B2.current.showModal();
    }, [T2]),
    (0, React.useEffect)(() => {
      if (!R2) return;
      let e3 = window.setTimeout(() => z2(``), 2500);
      return () => clearTimeout(e3);
    }, [R2]),
    (0, React.useEffect)(() => {
      if (!j2) return;
      let e3 = (e4) => {
          V2.current?.contains(e4.target) || M2(false);
        },
        t3 = (e4) => {
          e4.key === `Escape` && M2(false);
        };
      return (
        document.addEventListener(`click`, e3),
        document.addEventListener(`keydown`, t3),
        () => {
          (document.removeEventListener(`click`, e3),
            document.removeEventListener(`keydown`, t3));
        }
      );
    }, [j2]));
  function U2(e3) {
    (t2(e3),
      M2(false),
      (window.location.hash = e3),
      window.scrollTo({ top: 0, behavior: `smooth` }));
  }
  function W2(e3) {
    (s2(e3), l2(`All`), f2(``));
  }
  function oe2(e3) {
    let t3 = i2.includes(e3);
    (a2((n3) => (t3 ? n3.filter((t4) => t4 !== e3) : [...n3, e3])),
      z2(
        t3
          ? H2(
              `Removed from Saved for later`,
              `\uC800\uC7A5\uD55C \uC0C1\uD488\uC5D0\uC11C \uC81C\uAC70\uD588\uC5B4\uC694`,
            )
          : H2(
              `Added to Saved for later`,
              `\uB098\uC911\uC5D0 \uBCFC \uC0C1\uD488\uC5D0 \uC800\uC7A5\uD588\uC5B4\uC694`,
            ),
      ));
  }

  function K2() {
    (B2.current?.close(), O2(null));
  }
  let q2 = products
      .filter((e3) =>
        (o2 === `saved` && !i2.includes(e3.id)) ||
        (o2 === `desk` && ![`Tech`, `Home`].includes(e3.category)) ||
        (o2 === `carry` &&
          ![`Everyday carry`, `Style`].includes(e3.category)) ||
        (c2 !== `All` && e3.category !== c2)
          ? false
          : !d2.trim() ||
            `${e3.name} ${e3.brand} ${e3.category} ${e3.hook} ${e3.hookKo}`
              .toLowerCase()
              .includes(d2.trim().toLowerCase()),
      )
      .sort((e3, t3) =>
        p2 === `low`
          ? e3.price - t3.price
          : p2 === `high`
            ? t3.price - e3.price
            : products.indexOf(e3) - products.indexOf(t3),
      ),
    ce2 =
      o2 === `saved`
        ? H2(
            `Worth coming back to.`,
            `\uB2E4\uC2DC \uBCF4\uACE0 \uC2F6\uC740 \uBC1C\uACAC\uB4E4.`,
          )
        : o2 === `desk`
          ? H2(
              `A desk that feels like you.`,
              `\uB098\uB97C \uB2EE\uC740 \uB370\uC2A4\uD06C.`,
            )
          : o2 === `carry`
            ? H2(
                `Good company, every day.`,
                `\uB9E4\uC77C \uD568\uAED8\uD558\uACE0 \uC2F6\uC740 \uAC83\uB4E4.`,
              )
            : H2(
                `See it. Keep it.`,
                `\uBC1C\uACAC\uD558\uACE0, \uBAA8\uC544\uB450\uC138\uC694.`,
              );
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `needle-demo`,
    children: [
      (0, jsxRuntime.jsxs)(`header`, {
        className: `demo-header`,
        children: [
          (0, jsxRuntime.jsxs)(`a`, {
            className: `brand`,
            href: `#shopper`,
            onClick: () => U2(`shopper`),
            "aria-label": `Needle home`,
            children: [
              (0, jsxRuntime.jsx)(`span`, {
                className: `brand-glyph`,
                children: (0, jsxRuntime.jsx)(`img`, {
                  src: `./favicon.png`,
                  alt: ``,
                  width: 35,
                  height: 35,
                  "aria-hidden": `true`,
                }),
              }),
              `Needle`,
            ],
          }),
          (0, jsxRuntime.jsxs)(`nav`, {
            className: `workspace-switch`,
            "aria-label": H2(`Workspace`, `\uC791\uC5C5\uACF5\uAC04`),
            children: [
              (0, jsxRuntime.jsxs)(`button`, {
                className: e2 === `shopper` ? `active` : ``,
                onClick: () => U2(`shopper`),
                children: [
                  (0, jsxRuntime.jsx)(GridIcon, { size: 15 }),
                  H2(`My finds`, `\uB098\uC758 \uBC1C\uACAC`),
                ],
              }),
              (0, jsxRuntime.jsxs)(`button`, {
                className: e2 === `seller` ? `active` : ``,
                onClick: () => U2(`seller`),
                children: [
                  (0, jsxRuntime.jsx)(DashboardIcon, { size: 15 }),
                  H2(`Seller studio`, `\uC140\uB7EC \uC2A4\uD29C\uB514\uC624`),
                ],
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `header-right`,
            children: [
              (0, jsxRuntime.jsx)(`span`, {
                className: `demo-label`,
                children: `DEMO`,
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `language-toggle`,
                "aria-label": `Language`,
                children: [
                  (0, jsxRuntime.jsx)(`button`, {
                    "aria-pressed": n2 === `en`,
                    onClick: () => r2(`en`),
                    children: `EN`,
                  }),
                  (0, jsxRuntime.jsx)(`button`, {
                    "aria-pressed": n2 === `ko`,
                    onClick: () => r2(`ko`),
                    children: `KO`,
                  }),
                ],
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `profile-wrap`,
                "data-tour": `account`,
                ref: V2,
                children: [
                  (0, jsxRuntime.jsxs)(`button`, {
                    className: `profile-button`,
                    "aria-expanded": j2,
                    "aria-label": H2(
                      `Open demo Google profile`,
                      `\uB370\uBAA8 Google \uD504\uB85C\uD544 \uC5F4\uAE30`,
                    ),
                    onClick: () => M2(!j2),
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `avatar`,
                        children: `D`,
                      }),
                      (0, jsxRuntime.jsxs)(`span`, {
                        className: `profile-copy`,
                        children: [
                          (0, jsxRuntime.jsx)(`strong`, { children: `Demo` }),
                          (0, jsxRuntime.jsxs)(`small`, {
                            children: [
                              (0, jsxRuntime.jsx)(GoogleMark, {}),
                              ` `,
                              H2(
                                `Google \xB7 demo profile`,
                                `Google \xB7 \uB370\uBAA8 \uD504\uB85C\uD544`,
                              ),
                            ],
                          }),
                        ],
                      }),
                      (0, jsxRuntime.jsx)(ChevronDownIcon, { size: 13 }),
                    ],
                  }),
                  j2 &&
                    (0, jsxRuntime.jsxs)(`div`, {
                      className: `profile-popover`,
                      children: [
                        (0, jsxRuntime.jsx)(GoogleMark, {}),
                        (0, jsxRuntime.jsx)(`strong`, {
                          children: H2(
                            `One account. All your finds.`,
                            `\uD558\uB098\uC758 \uACC4\uC815, \uBAA8\uB4E0 \uBC1C\uACAC.`,
                          ),
                        }),
                        (0, jsxRuntime.jsx)(`p`, {
                          children: H2(
                            `This demo previews the account you would use in the Needle extension and website. Google sign-in and history sync are simulated here.`,
                            `\uD655\uC7A5 \uD504\uB85C\uADF8\uB7A8\uACFC \uC6F9\uC0AC\uC774\uD2B8\uC5D0\uC11C \uAC19\uC740 \uACC4\uC815\uC744 \uC0AC\uC6A9\uD558\uB294 \uD654\uBA74 \uC608\uC2DC\uC785\uB2C8\uB2E4. \uC774 \uB370\uBAA8\uC758 Google \uB85C\uADF8\uC778\uACFC \uAE30\uB85D \uB3D9\uAE30\uD654\uB294 \uC2DC\uBBAC\uB808\uC774\uC158\uC785\uB2C8\uB2E4.`,
                          ),
                        }),
                        (0, jsxRuntime.jsx)(`button`, {
                          onClick: () => M2(false),
                          children: H2(`Got it`, `\uD655\uC778`),
                        }),
                      ],
                    }),
                ],
              }),
            ],
          }),
        ],
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `workspace-layout ${e2 === `seller` ? `seller-layout` : ``}`,
        children: [
          (0, jsxRuntime.jsxs)(`aside`, {
            className: `demo-sidebar`,
            children: [
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sidebar-top`,
                children: [
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `section-kicker`,
                    children: H2(
                      `YOUR WORKSPACE`,
                      `\uB098\uC758 \uC791\uC5C5\uACF5\uAC04`,
                    ),
                  }),
                  e2 === `shopper`
                    ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                        children: [
                          (0, jsxRuntime.jsxs)(`button`, {
                            className: `sidebar-link ${o2 === `all` ? `selected` : ``}`,
                            onClick: () => W2(`all`),
                            children: [
                              (0, jsxRuntime.jsx)(HistoryIcon, { size: 17 }),
                              H2(`All finds`, `\uBAA8\uB4E0 \uBC1C\uACAC`),
                              (0, jsxRuntime.jsx)(`span`, {
                                children: products.length,
                              }),
                            ],
                          }),
                          (0, jsxRuntime.jsxs)(`button`, {
                            className: `sidebar-link ${o2 === `saved` ? `selected` : ``}`,
                            onClick: () => W2(`saved`),
                            children: [
                              (0, jsxRuntime.jsx)(BookmarkIcon, { size: 17 }),
                              H2(
                                `Saved for later`,
                                `\uC800\uC7A5\uD55C \uC0C1\uD488`,
                              ),
                              (0, jsxRuntime.jsx)(`span`, {
                                children: i2.length,
                              }),
                            ],
                          }),
                          (0, jsxRuntime.jsxs)(`div`, {
                            className: `collection-nav`,
                            "data-tour": `collections`,
                            children: [
                              (0, jsxRuntime.jsx)(`span`, {
                                className: `section-kicker`,
                                children: H2(
                                  `COLLECTIONS`,
                                  `\uCEEC\uB809\uC158`,
                                ),
                              }),
                              (0, jsxRuntime.jsxs)(`button`, {
                                className: `sidebar-link ${o2 === `desk` ? `selected` : ``}`,
                                onClick: () => W2(`desk`),
                                children: [
                                  (0, jsxRuntime.jsx)(`span`, {
                                    className: `collection-square violet`,
                                  }),
                                  (0, jsxRuntime.jsx)(`span`, {
                                    className: `collection-name`,
                                    children: H2(
                                      `A better desk`,
                                      `\uB354 \uC88B\uC740 \uB370\uC2A4\uD06C`,
                                    ),
                                  }),
                                ],
                              }),
                              (0, jsxRuntime.jsxs)(`button`, {
                                className: `sidebar-link ${o2 === `carry` ? `selected` : ``}`,
                                onClick: () => W2(`carry`),
                                children: [
                                  (0, jsxRuntime.jsx)(`span`, {
                                    className: `collection-square peach`,
                                  }),
                                  (0, jsxRuntime.jsx)(`span`, {
                                    className: `collection-name`,
                                    children: H2(
                                      `Everyday essentials`,
                                      `\uB9E4\uC77C\uC758 \uD544\uC218\uD488`,
                                    ),
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      })
                    : (0, jsxRuntime.jsxs)(`div`, {
                        className: `seller-side-links`,
                        children: [
                          (0, jsxRuntime.jsxs)(`a`, {
                            className: `sidebar-link selected`,
                            href: `#seller`,
                            onClick: (e3) => {
                              (e3.preventDefault(),
                                window.scrollTo({
                                  top: 0,
                                  behavior: `smooth`,
                                }));
                            },
                            children: [
                              (0, jsxRuntime.jsx)(DashboardIcon, { size: 17 }),
                              H2(`Overview`, `\uD55C\uB208\uC5D0 \uBCF4\uAE30`),
                            ],
                          }),
                          (0, jsxRuntime.jsxs)(`a`, {
                            className: `sidebar-link`,
                            href: `#seller`,
                            onClick: (e3) => {
                              (e3.preventDefault(),
                                document
                                  .querySelector(
                                    `[data-tour="seller-products"]`,
                                  )
                                  ?.scrollIntoView({
                                    behavior: `smooth`,
                                    block: `center`,
                                  }));
                            },
                            children: [
                              (0, jsxRuntime.jsx)(ShoppingBagIcon, {
                                size: 17,
                              }),
                              H2(`Your products`, `\uB0B4 \uC0C1\uD488`),
                            ],
                          }),
                          (0, jsxRuntime.jsxs)(`a`, {
                            className: `sidebar-link`,
                            href: `#seller`,
                            onClick: (e3) => {
                              (e3.preventDefault(),
                                document
                                  .querySelector(`.sd-performance`)
                                  ?.scrollIntoView({
                                    behavior: `smooth`,
                                    block: `start`,
                                  }));
                            },
                            children: [
                              (0, jsxRuntime.jsx)(ChartColumnIcon, {
                                size: 17,
                              }),
                              H2(
                                `Content performance`,
                                `\uCF58\uD150\uCE20 \uC131\uACFC`,
                              ),
                            ],
                          }),
                          (0, jsxRuntime.jsxs)(`a`, {
                            className: `sidebar-link`,
                            href: `#seller`,
                            onClick: (e3) => {
                              (e3.preventDefault(),
                                document
                                  .querySelector(
                                    `[data-tour="seller-creators"]`,
                                  )
                                  ?.scrollIntoView({
                                    behavior: `smooth`,
                                    block: `start`,
                                  }));
                            },
                            children: [
                              (0, jsxRuntime.jsx)(HeartIcon, { size: 17 }),
                              H2(
                                `Creator matches`,
                                `\uD06C\uB9AC\uC5D0\uC774\uD130 \uB9E4\uCE6D`,
                              ),
                            ],
                          }),
                        ],
                      }),
                ],
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sidebar-bottom`,
                children: [
                  (0, jsxRuntime.jsxs)(`div`, {
                    className: `extension-note`,
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `extension-emblem`,
                        children: (0, jsxRuntime.jsx)(MonitorIcon, {
                          size: 18,
                        }),
                      }),
                      (0, jsxRuntime.jsx)(`strong`, {
                        children:
                          e2 === `shopper`
                            ? H2(
                                `Spotted out there. Kept here.`,
                                `\uBC16\uC5D0\uC11C \uBC1C\uACAC\uD558\uACE0, \uC5EC\uAE30\uC11C \uBAA8\uC544\uC694.`,
                              )
                            : H2(
                                `Your product. Its next audience.`,
                                `\uB0B4 \uC0C1\uD488\uC744 \uC704\uD55C \uB2E4\uC74C \uACE0\uAC1D.`,
                              ),
                      }),
                      (0, jsxRuntime.jsx)(`p`, {
                        children:
                          e2 === `shopper`
                            ? H2(
                                `Your extension finds, together in one place.`,
                                `\uD655\uC7A5\uC5D0\uC11C \uCC3E\uC740 \uC0C1\uD488\uC744 \uD55C\uACF3\uC5D0\uC11C \uB2E4\uC2DC \uB9CC\uB098\uBCF4\uC138\uC694.`,
                              )
                            : H2(
                                `Track the story. Find the right voice.`,
                                `\uCF58\uD150\uCE20\uC758 \uC131\uACFC\uB97C \uBCF4\uACE0, \uC5B4\uC6B8\uB9AC\uB294 \uBAA9\uC18C\uB9AC\uB97C \uCC3E\uC73C\uC138\uC694.`,
                              ),
                      }),
                      (0, jsxRuntime.jsxs)(`span`, {
                        children: [
                          (0, jsxRuntime.jsx)(CheckCheckIcon, { size: 12 }),
                          e2 === `shopper`
                            ? H2(
                                `Extension history preview`,
                                `\uD655\uC7A5 \uAE30\uB85D \uBBF8\uB9AC\uBCF4\uAE30`,
                              )
                            : H2(
                                `Demo campaign workspace`,
                                `\uB370\uBAA8 \uCEA0\uD398\uC778 \uC791\uC5C5\uACF5\uAC04`,
                              ),
                        ],
                      }),
                    ],
                  }),
                  null,
                  (0, jsxRuntime.jsxs)(`button`, {
                    className: `tour-replay`,
                    onClick: () => ie2((e3) => e3 + 1),
                    children: [
                      (0, jsxRuntime.jsx)(PlayIcon, { size: 13 }),
                      H2(
                        `Take a quick tour`,
                        `\uD29C\uD1A0\uB9AC\uC5BC \uB2E4\uC2DC \uBCF4\uAE30`,
                      ),
                      (0, jsxRuntime.jsx)(ArrowUpRightIcon, { size: 13 }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`small`, {
                    children: [
                      `Needle \xB7 `,
                      H2(
                        `See it anywhere.`,
                        `\uC5B4\uB514\uC11C\uB4E0, \uBC1C\uACAC\uD558\uC138\uC694.`,
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`main`, {
            className: `demo-main`,
            children: [
              e2 === `shopper`
                ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                    children: [
                      (0, jsxRuntime.jsxs)(`section`, {
                        className: `library-heading`,
                        children: [
                          (0, jsxRuntime.jsxs)(`div`, {
                            children: [
                              (0, jsxRuntime.jsxs)(`div`, {
                                className: `welcome-line`,
                                children: [
                                  (0, jsxRuntime.jsx)(`span`, {
                                    className: `tiny-sun`,
                                    children: `\u2733`,
                                  }),
                                  H2(
                                    `GOOD TO SEE YOU, DEMO`,
                                    `\uB2E4\uC2DC \uB9CC\uB098 \uBC18\uAC00\uC6CC\uC694, DEMO`,
                                  ),
                                ],
                              }),
                              (0, jsxRuntime.jsx)(`h1`, { children: ce2 }),
                              (0, jsxRuntime.jsx)(`p`, {
                                children: H2(
                                  `Everything that caught your eye. Nothing lost in another tab.`,
                                  `\uB208\uAE38\uC774 \uAC14\uB358 \uBAA8\uB4E0 \uC0C1\uD488. \uC218\uB9CE\uC740 \uD0ED \uC18D\uC5D0\uC11C \uB2E4\uC2DC \uCC3E\uC9C0 \uC54A\uC544\uB3C4 \uB3FC\uC694.`,
                                ),
                              }),
                            ],
                          }),
                          (0, jsxRuntime.jsxs)(`div`, {
                            className: `history-count`,
                            children: [
                              (0, jsxRuntime.jsx)(`strong`, {
                                children: products.length
                                  .toString()
                                  .padStart(2, `0`),
                              }),
                              (0, jsxRuntime.jsx)(`span`, {
                                children: H2(
                                  `finds, all together`,
                                  `\uAC1C\uC758 \uBC1C\uACAC\uC744 \uD55C\uACF3\uC5D0`,
                                ),
                              }),
                            ],
                          }),
                        ],
                      }),
                      (0, jsxRuntime.jsxs)(`section`, {
                        className: `library-intro`,
                        children: [
                          (0, jsxRuntime.jsxs)(`div`, {
                            className: `journey-note`,
                            children: [
                              (0, jsxRuntime.jsxs)(`div`, {
                                className: `journey-icons`,
                                children: [
                                  (0, jsxRuntime.jsx)(`span`, {
                                    children: (0, jsxRuntime.jsx)(MonitorIcon, {
                                      size: 18,
                                    }),
                                  }),
                                  (0, jsxRuntime.jsx)(`i`, {}),
                                  (0, jsxRuntime.jsx)(`span`, {
                                    children: (0, jsxRuntime.jsx)(
                                      GoogleMark,
                                      {},
                                    ),
                                  }),
                                  (0, jsxRuntime.jsx)(`i`, {}),
                                  (0, jsxRuntime.jsx)(`span`, {
                                    children: (0, jsxRuntime.jsx)(GridIcon, {
                                      size: 18,
                                    }),
                                  }),
                                ],
                              }),
                              (0, jsxRuntime.jsxs)(`div`, {
                                children: [
                                  (0, jsxRuntime.jsx)(`strong`, {
                                    children: H2(
                                      `From your browser to your little corner.`,
                                      `\uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C, \uB098\uB9CC\uC758 \uACF5\uAC04\uC73C\uB85C.`,
                                    ),
                                  }),
                                  (0, jsxRuntime.jsx)(`p`, {
                                    children: H2(
                                      `The products you searched with Needle, collected for a second look.`,
                                      `Needle\uB85C \uAC80\uC0C9\uD588\uB358 \uC0C1\uD488\uC744 \uBAA8\uC544\uB480\uC5B4\uC694. \uCC9C\uCC9C\uD788 \uB2E4\uC2DC \uC0B4\uD3B4\uBCF4\uC138\uC694.`,
                                    ),
                                  }),
                                ],
                              }),
                              (0, jsxRuntime.jsx)(`span`, {
                                className: `fixture-chip`,
                                children: H2(
                                  `Sample history`,
                                  `\uC608\uC2DC \uAC80\uC0C9 \uAE30\uB85D`,
                                ),
                              }),
                            ],
                          }),
                          (0, jsxRuntime.jsx)(ExtensionDemo, {
                            lang: n2,
                            paused: Boolean(tourTarget) || Boolean(T2),
                          }),
                        ],
                      }),
                      (0, jsxRuntime.jsxs)(`section`, {
                        className: `library-controls`,
                        "data-tour": `filters`,
                        children: [
                          (0, jsxRuntime.jsx)(`div`, {
                            className: `filter-chips`,
                            "aria-label": H2(
                              `Product categories`,
                              `\uC0C1\uD488 \uCE74\uD14C\uACE0\uB9AC`,
                            ),
                            children: categories.map((e3) =>
                              (0, jsxRuntime.jsx)(
                                `button`,
                                {
                                  className: c2 === e3 ? `active` : ``,
                                  onClick: () => l2(e3),
                                  children:
                                    n2 === `ko` ? categoryLabels[e3] : e3,
                                },
                                e3,
                              ),
                            ),
                          }),
                          (0, jsxRuntime.jsxs)(`div`, {
                            className: `find-tools`,
                            children: [
                              (0, jsxRuntime.jsxs)(`label`, {
                                className: `library-search`,
                                children: [
                                  (0, jsxRuntime.jsx)(SearchIcon, { size: 15 }),
                                  (0, jsxRuntime.jsx)(`input`, {
                                    "aria-label": H2(
                                      `Search your finds`,
                                      `\uBC1C\uACAC\uD55C \uC0C1\uD488 \uAC80\uC0C9`,
                                    ),
                                    placeholder: H2(
                                      `Search your finds`,
                                      `\uBC1C\uACAC\uD55C \uC0C1\uD488 \uAC80\uC0C9`,
                                    ),
                                    value: d2,
                                    onChange: (e3) => f2(e3.target.value),
                                  }),
                                  d2 &&
                                    (0, jsxRuntime.jsx)(`button`, {
                                      "aria-label": H2(
                                        `Clear search`,
                                        `\uAC80\uC0C9 \uC9C0\uC6B0\uAE30`,
                                      ),
                                      onClick: () => f2(``),
                                      children: (0, jsxRuntime.jsx)(CloseIcon, {
                                        size: 12,
                                      }),
                                    }),
                                ],
                              }),
                              (0, jsxRuntime.jsxs)(`label`, {
                                className: `sort-control`,
                                children: [
                                  (0, jsxRuntime.jsx)(ArrowDownUpIcon, {
                                    size: 14,
                                  }),
                                  (0, jsxRuntime.jsxs)(`select`, {
                                    "aria-label": H2(
                                      `Sort products`,
                                      `\uC0C1\uD488 \uC815\uB82C`,
                                    ),
                                    value: p2,
                                    onChange: (e3) => m2(e3.target.value),
                                    children: [
                                      (0, jsxRuntime.jsx)(`option`, {
                                        value: `recent`,
                                        children: H2(
                                          `Latest finds`,
                                          `\uCD5C\uADFC \uBC1C\uACAC\uC21C`,
                                        ),
                                      }),
                                      (0, jsxRuntime.jsx)(`option`, {
                                        value: `low`,
                                        children: H2(
                                          `Price: low first`,
                                          `\uB0AE\uC740 \uAC00\uACA9\uC21C`,
                                        ),
                                      }),
                                      (0, jsxRuntime.jsx)(`option`, {
                                        value: `high`,
                                        children: H2(
                                          `Price: high first`,
                                          `\uB192\uC740 \uAC00\uACA9\uC21C`,
                                        ),
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                      (0, jsxRuntime.jsxs)(`div`, {
                        className: `results-heading`,
                        children: [
                          (0, jsxRuntime.jsx)(`span`, {
                            children: H2(
                              `YOUR DISCOVERY SHELF`,
                              `\uB098\uC758 \uBC1C\uACAC \uC120\uBC18`,
                            ),
                          }),
                          (0, jsxRuntime.jsxs)(`small`, {
                            children: [
                              q2.length,
                              ` `,
                              H2(
                                q2.length === 1 ? `find` : `finds`,
                                `\uAC1C \uC0C1\uD488`,
                              ),
                              (0, jsxRuntime.jsx)(`span`, {
                                className: `count-dot`,
                              }),
                              H2(
                                `Across your favorite places`,
                                `\uC5EC\uB7EC \uD50C\uB7AB\uD3FC\uC5D0\uC11C \uBAA8\uC558\uC5B4\uC694`,
                              ),
                            ],
                          }),
                        ],
                      }),
                      (0, jsxRuntime.jsxs)(`section`, {
                        className: `discovery-grid`,
                        "data-tour": `library`,
                        "aria-label": H2(
                          `Your searched products`,
                          `\uAC80\uC0C9\uD588\uB358 \uBAA8\uB4E0 \uC0C1\uD488`,
                        ),
                        children: [
                          q2.map((e3, t3) =>
                            (0, jsxRuntime.jsxs)(
                              `article`,
                              {
                                className: `find-card`,
                                style: {
                                  animationDelay: `${Math.min(t3, 7) * 45}ms`,
                                },
                                children: [
                                  (0, jsxRuntime.jsxs)(`div`, {
                                    className: `find-photo tint-${products.indexOf(e3) % 4}`,
                                    children: [
                                      (0, jsxRuntime.jsx)(`button`, {
                                        className: `photo-open`,
                                        onClick: () => O2(e3),
                                        "aria-label": `${H2(`View`, `\uC790\uC138\uD788 \uBCF4\uAE30`)} ${e3.name}`,
                                        children: (0, jsxRuntime.jsx)(`img`, {
                                          src: e3.image,
                                          alt: e3.name,
                                          loading: t3 < 3 ? `eager` : `lazy`,
                                          decoding: `async`,
                                        }),
                                      }),
                                      (0, jsxRuntime.jsxs)(`span`, {
                                        className: `card-source`,
                                        children: [
                                          (0, jsxRuntime.jsx)(SourceIcon, {
                                            source: e3.source,
                                          }),
                                          e3.source,
                                        ],
                                      }),
                                      (0, jsxRuntime.jsx)(`button`, {
                                        className: `save-find ${i2.includes(e3.id) ? `is-saved` : ``}`,
                                        "aria-label": `${i2.includes(e3.id) ? H2(`Unsave`, `\uC800\uC7A5 \uD574\uC81C`) : H2(`Save`, `\uC800\uC7A5`)} ${e3.name}`,
                                        "aria-pressed": i2.includes(e3.id),
                                        onClick: () => oe2(e3.id),
                                        children: (0, jsxRuntime.jsx)(
                                          BookmarkIcon,
                                          {
                                            size: 16,
                                            fill: i2.includes(e3.id)
                                              ? `currentColor`
                                              : `none`,
                                          },
                                        ),
                                      }),
                                    ],
                                  }),
                                  (0, jsxRuntime.jsxs)(`div`, {
                                    className: `find-info`,
                                    children: [
                                      (0, jsxRuntime.jsxs)(`div`, {
                                        className: `brand-line`,
                                        children: [
                                          (0, jsxRuntime.jsx)(`span`, {
                                            children: e3.brand,
                                          }),
                                          (0, jsxRuntime.jsx)(`span`, {
                                            children: formatProductPrice(e3),
                                          }),
                                        ],
                                      }),
                                      (0, jsxRuntime.jsxs)(`button`, {
                                        className: `product-name`,
                                        onClick: () => O2(e3),
                                        children: [
                                          e3.name,
                                          (0, jsxRuntime.jsx)(
                                            ArrowUpRightIcon,
                                            { size: 15 },
                                          ),
                                        ],
                                      }),
                                      (0, jsxRuntime.jsxs)(`div`, {
                                        className: `hook-line`,
                                        children: [
                                          (0, jsxRuntime.jsx)(`span`, {}),
                                          ` `,
                                          n2 === `ko` ? e3.hookKo : e3.hook,
                                        ],
                                      }),
                                      (0, jsxRuntime.jsxs)(`div`, {
                                        className: `find-meta`,
                                        children: [
                                          (0, jsxRuntime.jsx)(ClockIcon, {
                                            size: 11,
                                          }),
                                          e3.foundAt,
                                          (0, jsxRuntime.jsx)(`span`, {
                                            children:
                                              n2 === `ko`
                                                ? categoryLabels[e3.category]
                                                : e3.category,
                                          }),
                                        ],
                                      }),
                                    ],
                                  }),
                                ],
                              },
                              e3.id,
                            ),
                          ),
                          !q2.length &&
                            (0, jsxRuntime.jsxs)(`div`, {
                              className: `empty-shelf`,
                              children: [
                                (0, jsxRuntime.jsx)(SearchIcon, { size: 32 }),
                                (0, jsxRuntime.jsx)(`h2`, {
                                  children: H2(
                                    `A little too specific?`,
                                    `\uC544\uC9C1 \uB9DE\uB294 \uC0C1\uD488\uC774 \uC5C6\uC5B4\uC694.`,
                                  ),
                                }),
                                (0, jsxRuntime.jsx)(`p`, {
                                  children: H2(
                                    `Try another word, or make room for all your finds.`,
                                    `\uB2E4\uB978 \uAC80\uC0C9\uC5B4\uB97C \uC785\uB825\uD558\uAC70\uB098 \uBAA8\uB4E0 \uC0C1\uD488\uC744 \uD655\uC778\uD574\uBCF4\uC138\uC694.`,
                                  ),
                                }),
                                (0, jsxRuntime.jsxs)(`button`, {
                                  onClick: () => {
                                    (W2(`all`), m2(`recent`));
                                  },
                                  children: [
                                    H2(
                                      `Show all finds`,
                                      `\uBAA8\uB4E0 \uC0C1\uD488 \uBCF4\uAE30`,
                                    ),
                                    (0, jsxRuntime.jsx)(ArrowRightIcon, {
                                      size: 15,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                        ],
                      }),
                      (0, jsxRuntime.jsxs)(`div`, {
                        className: `shelf-end`,
                        children: [
                          (0, jsxRuntime.jsx)(`span`, {}),
                          (0, jsxRuntime.jsx)(`span`, {
                            className: `end-glyph`,
                            children: `n`,
                          }),
                          (0, jsxRuntime.jsx)(`p`, {
                            children: H2(
                              `Keep noticing. We\u2019ll keep your place.`,
                              `\uACC4\uC18D \uBC1C\uACAC\uD558\uC138\uC694. \uC5EC\uAE30\uC5D0 \uBAA8\uC544\uB458\uAC8C\uC694.`,
                            ),
                          }),
                          (0, jsxRuntime.jsx)(`span`, {}),
                        ],
                      }),
                    ],
                  })
                : (0, jsxRuntime.jsx)(SellerStudio, { lang: n2 }),
              (0, jsxRuntime.jsxs)(`footer`, {
                className: `demo-footer`,
                children: [
                  (0, jsxRuntime.jsx)(`span`, {
                    children: H2(
                      `Real products. Demo history, prices & insights.`,
                      `\uC2E4\uC81C \uC0C1\uD488 \xB7 \uB370\uBAA8 \uAC80\uC0C9 \uAE30\uB85D, \uAC00\uACA9 \uBC0F \uC778\uC0AC\uC774\uD2B8`,
                    ),
                  }),
                  (0, jsxRuntime.jsxs)(`div`, {
                    className: `demo-footer-actions`,
                    children: [
                      null,
                      (0, jsxRuntime.jsxs)(`button`, {
                        onClick: () => ie2((e3) => e3 + 1),
                        children: [
                          H2(
                            `Show me around`,
                            `\uD654\uBA74 \uC0AC\uC6A9\uBC95 \uBCF4\uAE30`,
                          ),
                          (0, jsxRuntime.jsx)(ArrowRightIcon, { size: 12 }),
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
      R2 &&
        (0, jsxRuntime.jsxs)(`div`, {
          className: `demo-toast`,
          role: `status`,
          children: [(0, jsxRuntime.jsx)(CheckIcon, { size: 16 }), R2],
        }),
      null,
      (0, jsxRuntime.jsx)(GuidedTour, {
        view: e2,
        startKey: ne2,
        onActiveTargetChange: setTourTarget,
      }),
      T2 &&
        (0, jsxRuntime.jsxs)(`dialog`, {
          className: `product-dialog`,
          "aria-labelledby": `product-detail-title`,
          ref: B2,
          onCancel: (e3) => {
            (e3.preventDefault(), K2());
          },
          onClick: (e3) => {
            e3.target === e3.currentTarget && K2();
          },
          children: [
            (0, jsxRuntime.jsx)(`button`, {
              className: `close-detail`,
              onClick: K2,
              "aria-label": H2(
                `Close product detail`,
                `\uC0C1\uD488 \uC0C1\uC138 \uB2EB\uAE30`,
              ),
              children: (0, jsxRuntime.jsx)(CloseIcon, { size: 20 }),
            }),
            (0, jsxRuntime.jsx)(`div`, {
              className: `detail-photo`,
              children: (0, jsxRuntime.jsx)(`img`, {
                src: T2.image,
                alt: T2.name,
              }),
            }),
            (0, jsxRuntime.jsxs)(`div`, {
              className: `detail-copy`,
              children: [
                (0, jsxRuntime.jsx)(`span`, {
                  className: `section-kicker`,
                  children: T2.brand,
                }),
                (0, jsxRuntime.jsx)(`h2`, {
                  id: `product-detail-title`,
                  children: T2.name,
                }),
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `detail-price`,
                  children: [
                    formatProductPrice(T2),
                    (0, jsxRuntime.jsx)(`small`, {
                      children: H2(`Demo price`, `\uC608\uC2DC \uAC00\uACA9`),
                    }),
                  ],
                }),
                (0, jsxRuntime.jsx)(`p`, {
                  children: n2 === `ko` ? T2.descriptionKo : T2.description,
                }),
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `detail-origin`,
                  children: [
                    (0, jsxRuntime.jsx)(SourceIcon, { source: T2.source }),
                    (0, jsxRuntime.jsxs)(`div`, {
                      children: [
                        (0, jsxRuntime.jsx)(`small`, {
                          children: H2(
                            `IN YOUR DEMO SEARCH HISTORY`,
                            `\uB370\uBAA8 \uAC80\uC0C9 \uAE30\uB85D\uC5D0\uC11C`,
                          ),
                        }),
                        (0, jsxRuntime.jsxs)(`strong`, {
                          children: [T2.source, ` \xB7 `, T2.foundAt],
                        }),
                      ],
                    }),
                  ],
                }),
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `detail-hook`,
                  children: [
                    (0, jsxRuntime.jsx)(SparklesIcon, { size: 15 }),
                    n2 === `ko` ? T2.hookKo : T2.hook,
                  ],
                }),
                (0, jsxRuntime.jsxs)(`button`, {
                  className: `detail-save`,
                  onClick: () => oe2(T2.id),
                  children: [
                    (0, jsxRuntime.jsx)(BookmarkIcon, {
                      size: 16,
                      fill: i2.includes(T2.id) ? `currentColor` : `none`,
                    }),
                    i2.includes(T2.id)
                      ? H2(`Saved for later`, `\uC800\uC7A5\uD55C \uC0C1\uD488`)
                      : H2(
                          `Save for later`,
                          `\uB098\uC911\uC5D0 \uBCFC \uC0C1\uD488\uC5D0 \uC800\uC7A5`,
                        ),
                  ],
                }),
                (0, jsxRuntime.jsxs)(`a`, {
                  className: `official-product`,
                  href: T2.productUrl,
                  target: `_blank`,
                  rel: `noreferrer`,
                  children: [
                    H2(
                      `View official product`,
                      `\uACF5\uC2DD \uC0C1\uD488 \uD398\uC774\uC9C0 \uBCF4\uAE30`,
                    ),
                    (0, jsxRuntime.jsx)(ExternalLinkIcon, { size: 14 }),
                  ],
                }),
                (0, jsxRuntime.jsx)(`small`, {
                  className: `detail-note`,
                  children: H2(
                    `A real product with an illustrative discovery story. Prices are demo values; check the official store for current details.`,
                    `\uC2E4\uC81C \uC0C1\uD488\uC744 \uC0AC\uC6A9\uD55C \uC608\uC2DC \uBC1C\uACAC \uAE30\uB85D\uC785\uB2C8\uB2E4. \uAC00\uACA9\uC740 \uB370\uBAA8\uC6A9\uC774\uBA70 \uCD5C\uC2E0 \uC815\uBCF4\uB294 \uACF5\uC2DD \uD310\uB9E4\uCC98\uC5D0\uC11C \uD655\uC778\uD558\uC138\uC694.`,
                  ),
                }),
              ],
            }),
          ],
        }),
    ],
  });
}

function App() {
  let [e2, t2] = (0, React.useState)(false);
  return (
    (0, React.useEffect)(() => t2(true), []),
    e2
      ? (0, jsxRuntime.jsx)(NeedleApp, {})
      : (0, jsxRuntime.jsx)(`main`, {
          style: {
            padding: 48,
            fontFamily: `sans-serif`,
            background: `#f8f8f2`,
            minHeight: `100vh`,
          },
          "aria-busy": `true`,
          children: `needle.`,
        })
  );
}

export {
  initialWorkspace,
  initialSavedProducts,
  formatProductPrice,
  GoogleMark,
  SourceIcon,
  NeedleApp,
  App,
};
export default App;
