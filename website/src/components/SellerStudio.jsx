import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { products } from "../data/products.js";
import {
  campaigns,
  campaignTitle,
  productReasons,
  defaultReasons,
  reasonLabels,
  getReasons,
  formatRevenue,
} from "../data/campaigns.js";
import { rankCreators, creators, creatorVideos } from "../data/creators.js";
import {
  CheckIcon,
  CloseIcon,
  ArrowRightIcon,
  SparklesIcon,
  ArrowUpRightIcon,
  PlusIcon,
  TrendingUpIcon,
  FlameIcon,
  ExternalLinkIcon,
} from "../icons.js";
import { matchLabels, CreatorMatches } from "./CreatorMatches.jsx";

function SellerStudio({ lang: e2 }) {
  let t2 = (t3, n3) => (e2 === `en` ? t3 : n3),
    [n2, r2] = (0, React.useState)(`30d`),
    [i2, a2] = (0, React.useState)(`all`),
    [o2, s2] = (0, React.useState)(() =>
      products.slice(0, 3).map((e3) => e3.id),
    ),
    [c2, l2] = (0, React.useState)(products[0]?.id ?? ``),
    [d2, f2] = (0, React.useState)([]),
    [p2, m2] = (0, React.useState)(null),
    [h2, v2] = (0, React.useState)(false),
    [y2, b2] = (0, React.useState)(``),
    [S2, C2] = (0, React.useState)(``),
    [ee2, E2] = (0, React.useState)({}),
    [D2, O2] = (0, React.useState)(``),
    [k2, A2] = (0, React.useState)(``),
    te2 = (0, React.useRef)(null),
    M2 = (0, React.useRef)(null),
    N2 = (0, React.useRef)(null),
    ne2 = (0, React.useRef)(null),
    P2 = products.find((e3) => e3.id === c2) ?? products[0],
    ae2 = Math.max(
      0,
      products.findIndex((e3) => e3.id === P2?.id),
    ),
    z2 = o2
      .map((e3) => products.find((t3) => t3.id === e3))
      .filter((e3) => !!e3),
    B2 = (n2 === `7d` ? 0.27 : 1) * (1 + ae2 * 0.07),
    V2 = campaigns.map((e3) => {
      let t3 = Math.round(e3.orders * B2);
      return {
        ...e3,
        views: Math.round(e3.views * B2),
        orders: t3,
        revenue: t3 * (P2?.price ?? 0),
        trend: campaignTitle(t3, n2 === `7d` ? e3.shape.slice(-7) : e3.shape),
      };
    }),
    H2 = V2.filter((e3) => i2 === `all` || e3.id === i2),
    U2 = H2.reduce((e3, t3) => e3 + t3.orders, 0),
    se2 = H2.reduce((e3, t3) => e3 + t3.revenue, 0),
    K2 = H2.reduce((e3, t3) => e3 + t3.views, 0),
    me2 = H2.reduce(
      (e3, t3) => e3 + t3.trend.slice(-2).reduce((e4, t4) => e4 + t4, 0),
      0,
    ),
    ge2 = Array.from({ length: n2 === `7d` ? 7 : 10 }, (e3, t3) =>
      H2.reduce((e4, n3) => e4 + n3.trend[t3], 0),
    ),
    _e2 = Math.max(1, ...ge2),
    ve2 = Object.entries(productReasons[P2?.id] ?? defaultReasons)
      .map(([e3, t3]) => ({ reason: e3, value: t3 }))
      .sort((e3, t3) => t3.value - e3.value),
    Y2 = ve2[0]?.reason ?? `design`,
    X2 = rankCreators(P2, creators, creatorVideos),
    Z2 = X2[0],
    Q2 = Z2?.creator,
    $2 = V2.find((e3) => e3.id === p2),
    ye2 = (e3) => X2.find((t3) => t3.creator.id === e3.id)?.score ?? 0;
  function be2(t3) {
    let n3 = P2?.name ?? ``,
      r3 = reasonLabels[Y2],
      i3 = {
        "aaron-loud-wireless": {
          angle: [
            `Hear the difference: ${n3} in everyday listening.`,
            `\uC9C1\uC811 \uB4E4\uC5B4\uBCF4\uB294 \uCC28\uC774: \uC77C\uC0C1 \uC18D ${n3}.`,
          ],
          why: [
            `Audio comparisons can demonstrate sound quality, comfort and noise cancellation with concrete listening tests.`,
            `\uCCAD\uC74C \uBE44\uAD50\uB97C \uD1B5\uD574 \uC74C\uC9C8\xB7\uCC29\uC6A9\uAC10\xB7\uB178\uC774\uC988 \uCE94\uC2AC\uB9C1\uC758 \uCC28\uC774\uB97C \uAD6C\uCCB4\uC801\uC73C\uB85C \uBCF4\uC5EC\uC904 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
          ],
        },
        "naomi-neo": {
          angle: [
            `A morning-to-evening routine with ${n3}.`,
            `${n3}\uACFC \uD568\uAED8\uD558\uB294 \uC544\uCE68\uBD80\uD130 \uC800\uB141\uAE4C\uC9C0\uC758 \uB8E8\uD2F4.`,
          ],
          why: [
            `Lifestyle storytelling could make ${r3[0].toLowerCase()} tangible in familiar daily moments.`,
            `\uC77C\uC0C1\uC758 \uC775\uC219\uD55C \uC21C\uAC04\uC744 \uD1B5\uD574 \u2018${r3[1]}\u2019\uC744 \uAD6C\uCCB4\uC801\uC73C\uB85C \uC804\uB2EC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
          ],
        },
        "andrea-chong": {
          angle: [
            `Three everyday looks, one ${n3}.`,
            `\uC138 \uAC00\uC9C0 \uB370\uC77C\uB9AC \uC2A4\uD0C0\uC77C, \uD558\uB098\uC758 ${n3}.`,
          ],
          why: [
            `A fashion-led brief could show how this product fits a considered daily wardrobe.`,
            `\uD328\uC158 \uC911\uC2EC\uC758 \uCF58\uD150\uCE20\uB85C \uC774 \uC0C1\uD488\uC774 \uC77C\uC0C1 \uC2A4\uD0C0\uC77C\uC5D0 \uC5B4\uC6B0\uB7EC\uC9C0\uB294 \uBAA8\uC2B5\uC744 \uBCF4\uC5EC\uC904 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
          ],
        },
        "sophia-chong": {
          angle: [
            `Pack ${n3} for a city weekend.`,
            `${n3}\uACFC \uB5A0\uB098\uB294 \uB3C4\uC2EC \uC8FC\uB9D0 \uC5EC\uD589.`,
          ],
          why: [
            `A travel-and-style story could put ${r3[0].toLowerCase()} into a real packing or day-out decision.`,
            `\uC5EC\uD589\xB7\uC2A4\uD0C0\uC77C \uCF58\uD150\uCE20\uC5D0\uC11C \u2018${r3[1]}\u2019\uC744 \uC9D0 \uAFB8\uB9AC\uAE30\uC640 \uC678\uCD9C\uC758 \uC120\uD0DD \uAE30\uC900\uC73C\uB85C \uBCF4\uC5EC\uC904 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
          ],
        },
        mongabong: {
          angle: [
            `Why ${n3} earns a place in my everyday setup.`,
            `${n3}\uC744 \uC77C\uC0C1 \uC544\uC774\uD15C\uC73C\uB85C \uACE0\uB974\uB294 \uC774\uC720.`,
          ],
          why: [
            `An everyday-lifestyle routine could explain the small details behind keeping this product close.`,
            `\uB77C\uC774\uD504\uC2A4\uD0C0\uC77C \uB8E8\uD2F4 \uC18D\uC5D0\uC11C \uC774 \uC0C1\uD488\uC744 \uACC4\uC18D \uC0AC\uC6A9\uD558\uB294 \uC791\uC740 \uB514\uD14C\uC77C\uC744 \uC124\uBA85\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
          ],
        },
        "geek-culture": {
          angle: [
            `Hands-on with ${n3}: test ${r3[0].toLowerCase()} in daily use.`,
            `${n3} \uC2E4\uC0AC\uC6A9: \uC77C\uC0C1 \uC18D \u2018${r3[1]}\u2019 \uD14C\uC2A4\uD2B8.`,
          ],
          why: /sony-wh|airpods/.test(P2?.id ?? ``)
            ? [
                `A hands-on tech brief could test noise cancellation and comfort during a real commute.`,
                `\uC9C1\uC811 \uC0AC\uC6A9\uD558\uB294 \uD14C\uD06C \uB9AC\uBDF0\uB85C \uCD9C\uD1F4\uADFC \uC911 \uB178\uC774\uC988 \uCE94\uC2AC\uB9C1\uACFC \uCC29\uC6A9\uAC10\uC744 \uC2DC\uD5D8\uD574\uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
              ]
            : [
                `A hands-on comparison could turn product specifications into practical, visible differences.`,
                `\uC9C1\uC811 \uBE44\uAD50\uD558\uB294 \uCF58\uD150\uCE20\uB85C \uC0C1\uD488 \uC0AC\uC591\uC744 \uC2E4\uC6A9\uC801\uC774\uACE0 \uB208\uC5D0 \uBCF4\uC774\uB294 \uCC28\uC774\uB85C \uD480\uC5B4\uB0BC \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
              ],
        },
        "the-smart-local": {
          angle: [
            `A Singapore day out with ${n3}.`,
            `${n3}\uACFC \uD568\uAED8\uD558\uB294 \uC2F1\uAC00\uD3EC\uB974\uC758 \uD558\uB8E8.`,
          ],
          why: [
            `A local guide could place this product in recognisable journeys, places and everyday choices.`,
            `\uB85C\uCEEC \uAC00\uC774\uB4DC \uD615\uC2DD\uC73C\uB85C \uC775\uC219\uD55C \uC774\uB3D9 \uACBD\uB85C\uC640 \uC7A5\uC18C, \uC77C\uC0C1\uC758 \uC120\uD0DD\uC5D0 \uC0C1\uD488\uC744 \uC5F0\uACB0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
          ],
        },
        sgag: {
          angle: [
            `That relatable moment before and after trying ${n3}.`,
            `${n3}\uC744 \uC4F0\uAE30 \uC804\uD6C4, \uB204\uAD6C\uB098 \uACF5\uAC10\uD560 \uADF8 \uC21C\uAC04.`,
          ],
          why: [
            `A comedy-led brief could dramatise a familiar inconvenience before showing a useful product detail.`,
            `\uACF5\uAC10\uD615 \uCF54\uBBF8\uB514\uB85C \uC775\uC219\uD55C \uBD88\uD3B8\uC744 \uBCF4\uC5EC\uC8FC\uACE0 \uC720\uC6A9\uD55C \uC0C1\uD488 \uB514\uD14C\uC77C\uB85C \uC774\uC5B4\uAC08 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
          ],
        },
        "seth-lui": {
          angle: [
            `From caf\xE9 hopping to a lunch break: where ${n3} fits.`,
            `\uCE74\uD398 \uD22C\uC5B4\uBD80\uD130 \uC810\uC2EC\uC2DC\uAC04\uAE4C\uC9C0, ${n3}\uC758 \uC790\uB9AC.`,
          ],
          why: [
            `A food-and-lifestyle setting could test whether the product adds something useful to a day out.`,
            `\uC74C\uC2DD\xB7\uB77C\uC774\uD504\uC2A4\uD0C0\uC77C \uB9E5\uB77D\uC5D0\uC11C \uC678\uCD9C\uD558\uB294 \uD558\uB8E8\uC5D0 \uC774 \uC0C1\uD488\uC774 \uC5B4\uB5A4 \uD3B8\uB9AC\uD568\uC744 \uB354\uD560\uC9C0 \uBCF4\uC5EC\uC904 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`,
          ],
        },
      },
      a3 = i3[t3.id] ?? i3[`the-smart-local`];
    return {
      angle: a3.angle[e2 === `en` ? 0 : 1],
      why: a3.why[e2 === `en` ? 0 : 1],
    };
  }
  ((0, React.useEffect)(() => {
    h2 && !te2.current?.open
      ? te2.current?.showModal()
      : h2 || te2.current?.close();
  }, [h2]),
    (0, React.useEffect)(() => {
      p2 && !M2.current?.open
        ? M2.current?.showModal()
        : p2 || M2.current?.close();
    }, [p2]),
    (0, React.useEffect)(() => {
      if (!k2) return;
      let e3 = window.setTimeout(() => A2(``), 5e3);
      return () => window.clearTimeout(e3);
    }, [k2]));
  function xe2() {
    let e3 = products.find((e4) => !o2.includes(e4.id)) ?? products[0];
    (b2(e3?.id ?? ``), C2(e3?.productUrl ?? ``), O2(``), v2(true));
  }
  function Se2(e3) {
    e3.preventDefault();
    let n3 = products.find((e4) => e4.id === y2);
    try {
      let e4 = new URL(S2);
      if (
        ![`https:`, `http:`].includes(e4.protocol) ||
        e4.username ||
        e4.password
      )
        throw Error();
    } catch {
      O2(
        t2(
          `Enter a valid product page URL.`,
          `\uC62C\uBC14\uB978 \uC0C1\uD488 \uD398\uC774\uC9C0 URL\uC744 \uC785\uB825\uD558\uC138\uC694.`,
        ),
      );
      return;
    }
    n3 &&
      (s2((e4) => (e4.includes(n3.id) ? e4 : [...e4, n3.id])),
      E2((e4) => ({ ...e4, [n3.id]: S2 })),
      l2(n3.id),
      v2(false),
      A2(
        t2(
          `${n3.name} added to your demo portfolio.`,
          `${n3.name}\uC744(\uB97C) \uB370\uBAA8 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC5D0 \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4.`,
        ),
      ));
  }
  function Ce2(e3) {
    let n3 = d2.includes(e3.id);
    (f2((t3) => (n3 ? t3.filter((t4) => t4 !== e3.id) : [...t3, e3.id])),
      A2(
        n3
          ? t2(
              `Removed from your demo shortlist.`,
              `\uB370\uBAA8 \uD6C4\uBCF4 \uBAA9\uB85D\uC5D0\uC11C \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4.`,
            )
          : t2(
              `${e3.name} added to your collaboration shortlist.`,
              `${e3.name}\uC744(\uB97C) \uD611\uC5C5 \uD6C4\uBCF4\uC5D0 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.`,
            ),
      ));
  }
  return P2
    ? (0, jsxRuntime.jsxs)(`section`, {
        className: `seller-demo`,
        children: [
          k2 &&
            (0, jsxRuntime.jsxs)(`div`, {
              className: `sd-toast`,
              role: `status`,
              children: [
                (0, jsxRuntime.jsx)(CheckIcon, { size: 16 }),
                (0, jsxRuntime.jsx)(`span`, { children: k2 }),
                (0, jsxRuntime.jsx)(`button`, {
                  "aria-label": t2(`Dismiss`, `\uB2EB\uAE30`),
                  onClick: () => A2(``),
                  children: (0, jsxRuntime.jsx)(CloseIcon, { size: 15 }),
                }),
              ],
            }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `sd-topline`,
            children: [
              (0, jsxRuntime.jsx)(`span`, { children: `NEEDLE FOR BUSINESS` }),
              (0, jsxRuntime.jsx)(`span`, {
                className: `sd-demo-badge`,
                children: t2(
                  `Illustrative demo data`,
                  `\uC608\uC2DC \uB370\uBAA8 \uB370\uC774\uD130`,
                ),
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`section`, {
            className: `sd-hero`,
            "data-tour": `seller-overview`,
            children: [
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sd-hero-copy`,
                children: [
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `sd-eyebrow`,
                    children: t2(
                      `FROM A PRODUCT TO ITS NEXT BIG MOMENT`,
                      `\uC0C1\uD488\uC5D0\uC11C, \uB2E4\uC74C \uD654\uC81C\uC758 \uC21C\uAC04\uC73C\uB85C`,
                    ),
                  }),
                  (0, jsxRuntime.jsxs)(`h1`, {
                    children: [
                      t2(
                        `Find your product.`,
                        `\uB0B4 \uC0C1\uD488\uC744 \uCC3E\uACE0,`,
                      ),
                      (0, jsxRuntime.jsx)(`br`, {}),
                      (0, jsxRuntime.jsx)(`em`, {
                        children: t2(
                          `Find your people.`,
                          `\uB9DE\uB294 \uD06C\uB9AC\uC5D0\uC774\uD130\uB85C.`,
                        ),
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsx)(`p`, {
                    children: t2(
                      `Find the creators who already speak your product\u2019s language. Match real reviews, explore recent videos, and see what moves sales.`,
                      `\uB0B4 \uC0C1\uD488\uC744 \uC774\uD574\uD558\uB294 \uD06C\uB9AC\uC5D0\uC774\uD130\uB97C \uCC3E\uC73C\uC138\uC694. \uC2E4\uC81C \uB9AC\uBDF0\uC758 \uC77C\uCE58\uB3C4, \uCD5C\uADFC \uC8FC\uBAA9 \uC601\uC0C1, \uD310\uB9E4\uB97C \uB9CC\uB4E0 \uCF58\uD150\uCE20\uB97C \uD55C\uACF3\uC5D0\uC11C \uD655\uC778\uD558\uC138\uC694.`,
                    ),
                  }),
                  (0, jsxRuntime.jsxs)(`div`, {
                    className: `sd-hero-actions`,
                    children: [
                      (0, jsxRuntime.jsxs)(`button`, {
                        onClick: () =>
                          N2.current?.scrollIntoView({ behavior: `smooth` }),
                        children: [
                          t2(
                            `Find my next creator`,
                            `\uB2E4\uC74C \uD06C\uB9AC\uC5D0\uC774\uD130 \uCC3E\uAE30`,
                          ),
                          (0, jsxRuntime.jsx)(ArrowRightIcon, { size: 16 }),
                        ],
                      }),
                      (0, jsxRuntime.jsxs)(`button`, {
                        className: `sd-quiet-button`,
                        onClick: () =>
                          ne2.current?.scrollIntoView({ behavior: `smooth` }),
                        children: [
                          t2(
                            `Explore content performance`,
                            `\uCF58\uD150\uCE20 \uC131\uACFC \uBCF4\uAE30`,
                          ),
                          (0, jsxRuntime.jsx)(ExternalArrow, {}),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              Q2 &&
                (0, jsxRuntime.jsxs)(`article`, {
                  className: `sd-featured`,
                  children: [
                    (0, jsxRuntime.jsxs)(`div`, {
                      className: `sd-featured-top`,
                      children: [
                        (0, jsxRuntime.jsxs)(`span`, {
                          children: [
                            (0, jsxRuntime.jsx)(SparklesIcon, { size: 13 }),
                            t2(
                              `YOUR NEXT COLLABORATION`,
                              `\uB2E4\uC74C \uD611\uC5C5 \uCD94\uCC9C`,
                            ),
                          ],
                        }),
                        (0, jsxRuntime.jsx)(`span`, {
                          className: `sd-location`,
                          children: `SG`,
                        }),
                      ],
                    }),
                    (0, jsxRuntime.jsxs)(`div`, {
                      className: `sd-featured-person`,
                      children: [
                        (0, jsxRuntime.jsx)(`div`, {
                          className: `sd-featured-avatar`,
                          style: { background: Q2.color },
                          children: Q2.avatar
                            ? (0, jsxRuntime.jsx)(`img`, {
                                src: Q2.avatar,
                                alt: Q2.name,
                              })
                            : Q2.initials,
                        }),
                        (0, jsxRuntime.jsxs)(`div`, {
                          children: [
                            (0, jsxRuntime.jsx)(`h2`, { children: Q2.name }),
                            (0, jsxRuntime.jsx)(`span`, {
                              children: e2 === `en` ? Q2.niche : Q2.nicheKo,
                            }),
                            (0, jsxRuntime.jsxs)(`a`, {
                              href: Q2.profileUrl,
                              target: `_blank`,
                              rel: `noreferrer`,
                              children: [
                                t2(
                                  `Public profile`,
                                  `\uACF5\uAC1C \uD504\uB85C\uD544`,
                                ),
                                (0, jsxRuntime.jsx)(ArrowUpRightIcon, {
                                  size: 12,
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, jsxRuntime.jsxs)(`div`, {
                          className: `sd-fit-circle`,
                          children: [
                            (0, jsxRuntime.jsx)(`strong`, {
                              children: ye2(Q2),
                            }),
                            (0, jsxRuntime.jsx)(`span`, {
                              children: t2(
                                `demo match`,
                                `\uC608\uC2DC \uC77C\uCE58\uB3C4`,
                              ),
                            }),
                          ],
                        }),
                      ],
                    }),
                    (0, jsxRuntime.jsxs)(`div`, {
                      className: `sd-featured-product`,
                      children: [
                        (0, jsxRuntime.jsx)(`img`, {
                          src: P2.image,
                          alt: P2.name,
                        }),
                        (0, jsxRuntime.jsxs)(`div`, {
                          children: [
                            (0, jsxRuntime.jsx)(`small`, {
                              children: t2(
                                `A new story for`,
                                `\uC774 \uC0C1\uD488\uC758 \uB2E4\uC74C \uC774\uC57C\uAE30`,
                              ),
                            }),
                            (0, jsxRuntime.jsx)(`strong`, {
                              children: P2.name,
                            }),
                            (0, jsxRuntime.jsx)(`span`, {
                              children: t2(
                                `${reasonLabels[Y2][0]} is the hook. Make it tangible.`,
                                `\u2018${reasonLabels[Y2][1]}\u2019\uC744 \uC9C1\uC811 \uB290\uB084 \uC218 \uC788\uB294 \uC774\uC57C\uAE30.`,
                              ),
                            }),
                          ],
                        }),
                      ],
                    }),
                    Z2?.video &&
                      (0, jsxRuntime.jsxs)(`a`, {
                        className: `cm-hero-evidence`,
                        href: Z2.video.url,
                        target: `_blank`,
                        rel: `noreferrer`,
                        children: [
                          (0, jsxRuntime.jsx)(`img`, {
                            src: Z2.video.thumbnail,
                            alt: Z2.video.title,
                          }),
                          (0, jsxRuntime.jsxs)(`span`, {
                            children: [
                              (0, jsxRuntime.jsx)(`small`, {
                                children:
                                  matchLabels[Z2.kind][e2 === `en` ? 0 : 1],
                              }),
                              Z2.video.title,
                            ],
                          }),
                          (0, jsxRuntime.jsx)(ArrowUpRightIcon, { size: 14 }),
                        ],
                      }),
                    (0, jsxRuntime.jsxs)(`div`, {
                      className: `sd-featured-brief`,
                      children: [
                        (0, jsxRuntime.jsx)(`span`, {
                          children: t2(
                            `SUGGESTED BRIEF`,
                            `\uC81C\uC548\uD558\uB294 \uCF58\uD150\uCE20`,
                          ),
                        }),
                        (0, jsxRuntime.jsx)(`strong`, {
                          children: be2(Q2).angle,
                        }),
                        (0, jsxRuntime.jsx)(`p`, { children: be2(Q2).why }),
                      ],
                    }),
                    (0, jsxRuntime.jsxs)(`button`, {
                      className: d2.includes(Q2.id) ? `saved` : ``,
                      onClick: () => Ce2(Q2),
                      children: [
                        d2.includes(Q2.id)
                          ? (0, jsxRuntime.jsx)(CheckIcon, { size: 15 })
                          : (0, jsxRuntime.jsx)(PlusIcon, { size: 15 }),
                        ` `,
                        d2.includes(Q2.id)
                          ? t2(
                              `On your shortlist`,
                              `\uD6C4\uBCF4 \uBAA9\uB85D\uC5D0 \uC800\uC7A5\uB428`,
                            )
                          : t2(
                              `Add to collaboration shortlist`,
                              `\uD611\uC5C5 \uD6C4\uBCF4\uC5D0 \uCD94\uAC00`,
                            ),
                        (0, jsxRuntime.jsx)(ArrowRightIcon, { size: 15 }),
                      ],
                    }),
                  ],
                }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`section`, {
            className: `sd-portfolio`,
            "data-tour": `seller-products`,
            children: [
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sd-section-heading`,
                children: [
                  (0, jsxRuntime.jsxs)(`div`, {
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `sd-eyebrow`,
                        children: t2(
                          `START WITH WHAT YOU SELL`,
                          `\uD310\uB9E4\uD558\uB294 \uC0C1\uD488\uC5D0\uC11C \uC2DC\uC791`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`h2`, {
                        children: t2(
                          `Your product, its whole story.`,
                          `\uB0B4 \uC0C1\uD488\uC774 \uB9CC\uB4E4\uC5B4\uB0B8 \uBAA8\uB4E0 \uC774\uC57C\uAE30.`,
                        ),
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`button`, {
                    className: `sd-outline-button`,
                    onClick: xe2,
                    children: [
                      (0, jsxRuntime.jsx)(PlusIcon, { size: 15 }),
                      t2(`Register a product`, `\uC0C1\uD488 \uB4F1\uB85D`),
                    ],
                  }),
                ],
              }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `sd-product-list`,
                children: z2.map((e3) =>
                  (0, jsxRuntime.jsxs)(
                    `button`,
                    {
                      className: `sd-product ${e3.id === P2.id ? `selected` : ``}`,
                      "aria-pressed": e3.id === P2.id,
                      onClick: () => l2(e3.id),
                      children: [
                        (0, jsxRuntime.jsx)(`span`, {
                          className: `sd-product-image`,
                          style: { background: e3.color },
                          children: (0, jsxRuntime.jsx)(`img`, {
                            src: e3.image,
                            alt: e3.name,
                          }),
                        }),
                        (0, jsxRuntime.jsxs)(`span`, {
                          className: `sd-product-info`,
                          children: [
                            (0, jsxRuntime.jsx)(`small`, {
                              children: e3.brand,
                            }),
                            (0, jsxRuntime.jsx)(`strong`, {
                              children: e3.name,
                            }),
                            (0, jsxRuntime.jsxs)(`span`, {
                              children: [
                                getReasons(e3.price),
                                ` `,
                                (0, jsxRuntime.jsx)(`i`, {}),
                                e3.category,
                              ],
                            }),
                          ],
                        }),
                        (0, jsxRuntime.jsx)(`span`, {
                          className: `sd-product-radio`,
                          children:
                            e3.id === P2.id &&
                            (0, jsxRuntime.jsx)(CheckIcon, { size: 11 }),
                        }),
                      ],
                    },
                    e3.id,
                  ),
                ),
              }),
            ],
          }),
          (0, jsxRuntime.jsx)(`section`, {
            className: `sd-creators-section`,
            ref: N2,
            "data-tour": `seller-creators`,
            children: (0, jsxRuntime.jsx)(
              CreatorMatches,
              { product: P2, lang: e2, shortlist: d2, onToggle: Ce2 },
              P2.id,
            ),
          }),
          (0, jsxRuntime.jsxs)(`section`, {
            className: `sd-performance`,
            ref: ne2,
            children: [
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sd-section-heading`,
                children: [
                  (0, jsxRuntime.jsxs)(`div`, {
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `sd-eyebrow`,
                        children: t2(
                          `THE CONTENT THAT MOVES YOUR PRODUCT`,
                          `\uC0C1\uD488\uC744 \uC6C0\uC9C1\uC774\uB294 \uCF58\uD150\uCE20`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`h2`, {
                        children: t2(
                          `One product. Four paths to purchase.`,
                          `\uD558\uB098\uC758 \uC0C1\uD488, \uB124 \uAC00\uC9C0 \uAD6C\uB9E4 \uACBD\uB85C.`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`p`, {
                        children: t2(
                          `Demo campaigns \xB7 simulated attribution. These are not actual endorsements or measured sales.`,
                          `\uB370\uBAA8 \uCEA0\uD398\uC778 \xB7 \uBAA8\uC758 \uAE30\uC5EC\uB3C4\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uD64D\uBCF4 \uC774\uB825\uC774\uB098 \uCE21\uC815\uB41C \uB9E4\uCD9C\uC774 \uC544\uB2D9\uB2C8\uB2E4.`,
                        ),
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`div`, {
                    className: `sd-period`,
                    children: [
                      (0, jsxRuntime.jsx)(`button`, {
                        className: n2 === `7d` ? `active` : ``,
                        onClick: () => r2(`7d`),
                        "aria-pressed": n2 === `7d`,
                        children: t2(`7 days`, `7\uC77C`),
                      }),
                      (0, jsxRuntime.jsx)(`button`, {
                        className: n2 === `30d` ? `active` : ``,
                        onClick: () => r2(`30d`),
                        "aria-pressed": n2 === `30d`,
                        children: t2(`30 days`, `30\uC77C`),
                      }),
                    ],
                  }),
                ],
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sd-source-tabs`,
                children: [
                  (0, jsxRuntime.jsx)(`button`, {
                    className: i2 === `all` ? `active` : ``,
                    onClick: () => a2(`all`),
                    children: t2(
                      `All platforms`,
                      `\uC804\uCCB4 \uD50C\uB7AB\uD3FC`,
                    ),
                  }),
                  campaigns.map((e3) =>
                    (0, jsxRuntime.jsxs)(
                      `button`,
                      {
                        className: i2 === e3.id ? `active` : ``,
                        onClick: () => a2(e3.id),
                        children: [
                          (0, jsxRuntime.jsx)(`span`, {
                            style: { color: e3.color },
                            children: e3.mark,
                          }),
                          e3.id,
                        ],
                      },
                      e3.id,
                    ),
                  ),
                ],
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sd-metrics`,
                children: [
                  (0, jsxRuntime.jsxs)(`article`, {
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        children: t2(
                          `Attributed revenue`,
                          `\uAE30\uC5EC \uB9E4\uCD9C`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`strong`, {
                        children: getReasons(se2),
                      }),
                      (0, jsxRuntime.jsx)(`small`, {
                        children: t2(
                          `Simulated orders \xD7 demo price`,
                          `\uBAA8\uC758 \uC8FC\uBB38 \uC218 \xD7 \uC608\uC2DC \uAC00\uACA9`,
                        ),
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`article`, {
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        children: t2(
                          `Content-driven orders`,
                          `\uCF58\uD150\uCE20\uC5D0\uC11C \uBC1C\uC0DD\uD55C \uC8FC\uBB38`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`strong`, {
                        children: U2.toLocaleString(),
                      }),
                      (0, jsxRuntime.jsx)(`small`, {
                        children: t2(
                          `Simulated attribution`,
                          `\uBAA8\uC758 \uAE30\uC5EC\uB3C4`,
                        ),
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`article`, {
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        children: t2(
                          `Content views`,
                          `\uCF58\uD150\uCE20 \uC870\uD68C`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`strong`, {
                        children: formatRevenue(K2),
                      }),
                      (0, jsxRuntime.jsx)(`small`, {
                        children: t2(
                          `Across selected demo campaigns`,
                          `\uC120\uD0DD\uD55C \uB370\uBAA8 \uCEA0\uD398\uC778 \uD569\uACC4`,
                        ),
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`article`, {
                    className: `sd-metric-accent`,
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        children: t2(
                          `Orders still coming in`,
                          `\uCD5C\uADFC\uAE4C\uC9C0 \uC774\uC5B4\uC9C0\uB294 \uC8FC\uBB38`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`strong`, { children: me2 }),
                      (0, jsxRuntime.jsx)(`small`, {
                        children: t2(
                          `Final two periods in the chart`,
                          `\uCC28\uD2B8 \uB9C8\uC9C0\uB9C9 \uB450 \uAD6C\uAC04 \uD569\uACC4`,
                        ),
                      }),
                    ],
                  }),
                ],
              }),
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sd-performance-summary`,
                children: [
                  (0, jsxRuntime.jsxs)(`article`, {
                    className: `sd-trend-card`,
                    children: [
                      (0, jsxRuntime.jsxs)(`div`, {
                        className: `sd-card-heading`,
                        children: [
                          (0, jsxRuntime.jsxs)(`div`, {
                            children: [
                              (0, jsxRuntime.jsx)(`h3`, {
                                children: t2(
                                  `The spike. And what stayed.`,
                                  `\uD130\uC9C4 \uC21C\uAC04, \uADF8\uB9AC\uACE0 \uB0A8\uC740 \uD798.`,
                                ),
                              }),
                              (0, jsxRuntime.jsx)(`p`, {
                                children: t2(
                                  `Simulated orders over time`,
                                  `\uC2DC\uAC04\uC5D0 \uB530\uB978 \uBAA8\uC758 \uC8FC\uBB38`,
                                ),
                              }),
                            ],
                          }),
                          (0, jsxRuntime.jsxs)(`span`, {
                            className: `sd-chart-legend`,
                            children: [
                              (0, jsxRuntime.jsx)(`i`, {}),
                              t2(`Orders`, `\uC8FC\uBB38`),
                            ],
                          }),
                        ],
                      }),
                      (0, jsxRuntime.jsxs)(`div`, {
                        className: `sd-chart`,
                        children: [
                          (0, jsxRuntime.jsxs)(`div`, {
                            className: `sd-chart-grid`,
                            children: [
                              (0, jsxRuntime.jsx)(`span`, {}),
                              (0, jsxRuntime.jsx)(`span`, {}),
                              (0, jsxRuntime.jsx)(`span`, {}),
                              (0, jsxRuntime.jsx)(`span`, {}),
                            ],
                          }),
                          (0, jsxRuntime.jsx)(`div`, {
                            className: `sd-chart-bars`,
                            children: ge2.map((r3, i3) =>
                              (0, jsxRuntime.jsxs)(
                                `div`,
                                {
                                  className: `sd-chart-column`,
                                  children: [
                                    (0, jsxRuntime.jsx)(`div`, {
                                      className: `sd-chart-bar ${i3 > ge2.length - 3 ? `latest` : ``}`,
                                      style: {
                                        height: `${Math.max(4, (r3 / _e2) * 100)}%`,
                                      },
                                      title: `${r3} ${t2(`simulated orders`, `\uBAA8\uC758 \uC8FC\uBB38`)}`,
                                      children: (0, jsxRuntime.jsx)(`span`, {
                                        children: r3,
                                      }),
                                    }),
                                    (0, jsxRuntime.jsx)(`small`, {
                                      children:
                                        n2 === `7d`
                                          ? (e2 === `en`
                                              ? [
                                                  `Mon`,
                                                  `Tue`,
                                                  `Wed`,
                                                  `Thu`,
                                                  `Fri`,
                                                  `Sat`,
                                                  `Sun`,
                                                ]
                                              : [
                                                  `\uC6D4`,
                                                  `\uD654`,
                                                  `\uC218`,
                                                  `\uBAA9`,
                                                  `\uAE08`,
                                                  `\uD1A0`,
                                                  `\uC77C`,
                                                ])[i3]
                                          : i3 === 0
                                            ? t2(`Day 1`, `1\uC77C`)
                                            : i3 === 4
                                              ? t2(`Day 15`, `15\uC77C`)
                                              : i3 === 9
                                                ? t2(`Day 30`, `30\uC77C`)
                                                : ``,
                                    }),
                                  ],
                                },
                                i3,
                              ),
                            ),
                          }),
                        ],
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`article`, {
                    className: `sd-longevity`,
                    children: [
                      (0, jsxRuntime.jsx)(TrendingUpIcon, { size: 23 }),
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `sd-eyebrow`,
                        children: t2(
                          `DON\u2019T STOP AT GOING VIRAL`,
                          `\uBC14\uC774\uB7F4\uC5D0\uC11C \uBA48\uCD94\uC9C0 \uC54A\uAE30`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`h3`, {
                        children: t2(
                          `Find the content with a longer life.`,
                          `\uC624\uB798 \uD314\uB9AC\uB294 \uCF58\uD150\uCE20\uB97C \uCC3E\uC73C\uC138\uC694.`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`p`, {
                        children: t2(
                          `A short video can create a burst. A searchable review can keep answering questions long after the first click.`,
                          `\uC9E7\uC740 \uC601\uC0C1\uC740 \uC21C\uAC04\uC758 \uAD00\uC2EC\uC744 \uB9CC\uB4ED\uB2C8\uB2E4. \uAC80\uC0C9\uB418\uB294 \uB9AC\uBDF0\uB294 \uCCAB \uD074\uB9AD\uC774 \uC9C0\uB098\uB3C4 \uACC4\uC18D \uAD6C\uB9E4 \uC804 \uC9C8\uBB38\uC5D0 \uB2F5\uD569\uB2C8\uB2E4.`,
                        ),
                      }),
                      (0, jsxRuntime.jsxs)(`div`, {
                        children: [
                          (0, jsxRuntime.jsx)(`span`, {
                            children: t2(
                              `Steady-tail channels`,
                              `\uAD00\uC2EC\uC774 \uC9C0\uC18D\uB418\uB294 \uCC44\uB110`,
                            ),
                          }),
                          (0, jsxRuntime.jsx)(`strong`, {
                            children: `Naver Blog + YouTube`,
                          }),
                        ],
                      }),
                      (0, jsxRuntime.jsx)(`small`, {
                        children: t2(
                          `Illustrative pattern in this demo dataset`,
                          `\uD604\uC7AC \uB370\uBAA8 \uB370\uC774\uD130\uC5D0\uC11C \uBCF4\uC5EC\uC8FC\uB294 \uC608\uC2DC \uD328\uD134`,
                        ),
                      }),
                    ],
                  }),
                ],
              }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `sd-campaign-grid`,
                children: H2.map((n3) =>
                  (0, jsxRuntime.jsxs)(
                    `article`,
                    {
                      className: `sd-campaign`,
                      children: [
                        (0, jsxRuntime.jsxs)(`button`, {
                          className: `sd-campaign-visual`,
                          onClick: () => m2(n3.id),
                          "aria-label": `${t2(`Open demo campaign`, `\uB370\uBAA8 \uCEA0\uD398\uC778 \uC5F4\uAE30`)} ${n3.id}`,
                          style: {
                            background:
                              n3.id === `YouTube`
                                ? `#e9e3d9`
                                : n3.id === `Naver Blog`
                                  ? `#e2e8dc`
                                  : n3.id === `TikTok`
                                    ? `#e0e2df`
                                    : `#f0e3da`,
                          },
                          children: [
                            (0, jsxRuntime.jsxs)(`div`, {
                              className: `sd-campaign-visual-copy`,
                              children: [
                                (0, jsxRuntime.jsx)(`span`, {
                                  children:
                                    n3.id === `Naver Blog`
                                      ? t2(
                                          `THE LONG-TERM REVIEW`,
                                          `\uC624\uB798 \uC368\uBCF8 \uB9AC\uBDF0`,
                                        )
                                      : n3.kind === `burst`
                                        ? t2(
                                            `ONE MOMENT. BIG IMPACT.`,
                                            `\uD55C \uC21C\uAC04, \uD070 \uCC28\uC774.`,
                                          )
                                        : t2(
                                            `MADE FOR THE EVERYDAY`,
                                            `\uC77C\uC0C1\uC744 \uC704\uD55C \uC120\uD0DD`,
                                          ),
                                }),
                                (0, jsxRuntime.jsx)(`strong`, {
                                  children:
                                    n3.kind === `burst`
                                      ? t2(
                                          `Worth a second look.`,
                                          `\uB2E4\uC2DC \uBCF4\uAC8C \uB418\uB294 \uC774\uC720.`,
                                        )
                                      : n3.id === `Naver Blog`
                                        ? t2(
                                            `Two weeks. Real details.`,
                                            `2\uC8FC \uB3D9\uC548 \uBC1C\uACAC\uD55C \uB514\uD14C\uC77C.`,
                                          )
                                        : t2(
                                            `A little more everyday.`,
                                            `\uC870\uAE08 \uB354 \uB098\uC740 \uC77C\uC0C1.`,
                                          ),
                                }),
                              ],
                            }),
                            (0, jsxRuntime.jsx)(`img`, {
                              src: P2.image,
                              alt: P2.name,
                            }),
                            (0, jsxRuntime.jsx)(`span`, {
                              className: `sd-visual-platform`,
                              style: { color: n3.color },
                              children: n3.mark,
                            }),
                            (0, jsxRuntime.jsx)(`span`, {
                              className: `sd-campaign-demo`,
                              children: t2(
                                `Demo campaign`,
                                `\uB370\uBAA8 \uCEA0\uD398\uC778`,
                              ),
                            }),
                          ],
                        }),
                        (0, jsxRuntime.jsxs)(`div`, {
                          className: `sd-campaign-body`,
                          children: [
                            (0, jsxRuntime.jsxs)(`div`, {
                              className: `sd-campaign-platform`,
                              children: [
                                (0, jsxRuntime.jsxs)(`span`, {
                                  style: { color: n3.color },
                                  children: [n3.mark, ` `, n3.id],
                                }),
                                (0, jsxRuntime.jsxs)(`span`, {
                                  className:
                                    n3.kind === `burst` ? `burst` : `steady`,
                                  children: [
                                    n3.kind === `burst`
                                      ? (0, jsxRuntime.jsx)(FlameIcon, {
                                          size: 11,
                                        })
                                      : (0, jsxRuntime.jsx)(TrendingUpIcon, {
                                          size: 11,
                                        }),
                                    ` `,
                                    n3.kind === `burst`
                                      ? t2(
                                          `Viral burst`,
                                          `\uBC14\uC774\uB7F4 \uAE09\uC99D`,
                                        )
                                      : t2(
                                          `Still converting`,
                                          `\uAFB8\uC900\uD55C \uC804\uD658`,
                                        ),
                                  ],
                                }),
                              ],
                            }),
                            (0, jsxRuntime.jsxs)(`button`, {
                              className: `sd-campaign-title`,
                              onClick: () => m2(n3.id),
                              children: [
                                e2 === `en` ? n3.title : n3.titleKo,
                                (0, jsxRuntime.jsx)(ArrowUpRightIcon, {
                                  size: 14,
                                }),
                              ],
                            }),
                            (0, jsxRuntime.jsx)(`p`, {
                              children: t2(
                                `Fictional campaign \xB7 simulated results`,
                                `\uAC00\uC0C1 \uCEA0\uD398\uC778 \xB7 \uBAA8\uC758 \uC131\uACFC`,
                              ),
                            }),
                            (0, jsxRuntime.jsxs)(`div`, {
                              className: `sd-campaign-stats`,
                              children: [
                                (0, jsxRuntime.jsxs)(`span`, {
                                  children: [
                                    (0, jsxRuntime.jsx)(`strong`, {
                                      children: formatRevenue(n3.views),
                                    }),
                                    (0, jsxRuntime.jsx)(`small`, {
                                      children: t2(`views`, `\uC870\uD68C`),
                                    }),
                                  ],
                                }),
                                (0, jsxRuntime.jsxs)(`span`, {
                                  children: [
                                    (0, jsxRuntime.jsx)(`strong`, {
                                      children: n3.orders,
                                    }),
                                    (0, jsxRuntime.jsx)(`small`, {
                                      children: t2(`orders`, `\uC8FC\uBB38`),
                                    }),
                                  ],
                                }),
                                (0, jsxRuntime.jsxs)(`span`, {
                                  children: [
                                    (0, jsxRuntime.jsx)(`strong`, {
                                      children: getReasons(n3.revenue),
                                    }),
                                    (0, jsxRuntime.jsx)(`small`, {
                                      children: t2(`revenue`, `\uB9E4\uCD9C`),
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            (0, jsxRuntime.jsx)(`div`, {
                              className: `sd-mini-trend`,
                              children: n3.trend.map((e3, t3) =>
                                (0, jsxRuntime.jsx)(
                                  `span`,
                                  {
                                    style: {
                                      height: `${Math.max(8, (e3 / Math.max(...n3.trend, 1)) * 100)}%`,
                                      background:
                                        n3.kind === `burst`
                                          ? `#d99a76`
                                          : `#93a288`,
                                    },
                                  },
                                  t3,
                                ),
                              ),
                            }),
                            (0, jsxRuntime.jsxs)(`button`, {
                              className: `sd-campaign-details`,
                              onClick: () => m2(n3.id),
                              children: [
                                t2(
                                  `See the content story`,
                                  `\uCF58\uD150\uCE20\uBCC4 \uD750\uB984 \uBCF4\uAE30`,
                                ),
                                (0, jsxRuntime.jsx)(ArrowRightIcon, {
                                  size: 13,
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    },
                    n3.id,
                  ),
                ),
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`section`, {
            className: `sd-reason-section`,
            "data-tour": `seller-reasons`,
            children: [
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sd-reason-intro`,
                children: [
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `sd-eyebrow`,
                    children: t2(
                      `WHY THE STORY WORKED`,
                      `\uC774 \uC774\uC57C\uAE30\uAC00 \uD1B5\uD558\uB294 \uC774\uC720`,
                    ),
                  }),
                  (0, jsxRuntime.jsxs)(`h2`, {
                    children: [
                      t2(
                        `Not just who watched.`,
                        `\uB204\uAC00 \uBD24\uB294\uC9C0\uBCF4\uB2E4,`,
                      ),
                      (0, jsxRuntime.jsx)(`br`, {}),
                      (0, jsxRuntime.jsx)(`em`, {
                        children: t2(
                          `What made them care.`,
                          `\uC65C \uB9C8\uC74C\uC774 \uC6C0\uC9C1\uC600\uB294\uC9C0.`,
                        ),
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsx)(`p`, {
                    children: t2(
                      `The next brief starts with ${reasonLabels[Y2][0].toLowerCase()}. Show the attribute people notice, then give the right creator room to make it their own.`,
                      `\uB2E4\uC74C \uBE0C\uB9AC\uD504\uB294 \u2018${reasonLabels[Y2][1]}\u2019\uC5D0\uC11C \uC2DC\uC791\uD569\uB2C8\uB2E4. \uC0AC\uB78C\uB4E4\uC774 \uC54C\uC544\uBCF4\uB294 \uB9E4\uB825\uC744 \uBCF4\uC5EC\uC8FC\uACE0, \uC5B4\uC6B8\uB9AC\uB294 \uD06C\uB9AC\uC5D0\uC774\uD130\uC758 \uC774\uC57C\uAE30\uB85C \uD480\uC5B4\uB0B4\uC138\uC694.`,
                    ),
                  }),
                  (0, jsxRuntime.jsx)(`span`, {
                    className: `sd-soft-badge`,
                    children: t2(
                      `Illustrative reason mix`,
                      `\uC608\uC2DC \uC120\uD0DD \uC774\uC720 \uAD6C\uC131`,
                    ),
                  }),
                ],
              }),
              (0, jsxRuntime.jsx)(`div`, {
                className: `sd-reason-bars`,
                children: ve2.map((t3, n3) =>
                  (0, jsxRuntime.jsxs)(
                    `div`,
                    {
                      className: `sd-reason-row`,
                      children: [
                        (0, jsxRuntime.jsx)(`span`, {
                          children:
                            reasonLabels[t3.reason][e2 === `en` ? 0 : 1],
                        }),
                        (0, jsxRuntime.jsx)(`div`, {
                          children: (0, jsxRuntime.jsx)(`span`, {
                            className: n3 === 0 ? `first` : ``,
                            style: { width: `${t3.value * 2}%` },
                          }),
                        }),
                        (0, jsxRuntime.jsxs)(`strong`, {
                          children: [t3.value, `%`],
                        }),
                      ],
                    },
                    t3.reason,
                  ),
                ),
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `sd-bottom-note`,
            children: [
              (0, jsxRuntime.jsx)(`span`, {
                children: t2(
                  `Simulated seller workspace`,
                  `\uBAA8\uC758 \uC140\uB7EC \uC791\uC5C5\uACF5\uAC04`,
                ),
              }),
              (0, jsxRuntime.jsxs)(`a`, {
                href: ee2[P2.id] ?? P2.productUrl,
                target: `_blank`,
                rel: `noreferrer`,
                children: [
                  t2(
                    `View product page`,
                    `\uC0C1\uD488 \uD398\uC774\uC9C0 \uBCF4\uAE30`,
                  ),
                  (0, jsxRuntime.jsx)(ExternalLinkIcon, { size: 12 }),
                ],
              }),
              (0, jsxRuntime.jsx)(`p`, {
                children: t2(
                  `No live analytics, actual creator fees, or verified sales attribution are connected.`,
                  `\uC2E4\uC2DC\uAC04 \uBD84\uC11D\xB7\uC2E4\uC81C \uD06C\uB9AC\uC5D0\uC774\uD130 \uBE44\uC6A9\xB7\uAC80\uC99D\uB41C \uD310\uB9E4 \uAE30\uC5EC\uB3C4\uB294 \uC5F0\uACB0\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`,
                ),
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`dialog`, {
            ref: te2,
            className: `sd-dialog sd-add-dialog`,
            onCancel: () => v2(false),
            onClose: () => v2(false),
            children: [
              (0, jsxRuntime.jsxs)(`div`, {
                className: `sd-dialog-heading`,
                children: [
                  (0, jsxRuntime.jsx)(`h2`, {
                    children: t2(
                      `Connect your next product.`,
                      `\uB2E4\uC74C \uC0C1\uD488\uC744 \uC5F0\uACB0\uD558\uC138\uC694.`,
                    ),
                  }),
                  (0, jsxRuntime.jsx)(`button`, {
                    onClick: () => v2(false),
                    "aria-label": t2(`Close`, `\uB2EB\uAE30`),
                    children: (0, jsxRuntime.jsx)(CloseIcon, { size: 19 }),
                  }),
                ],
              }),
              (0, jsxRuntime.jsx)(`p`, {
                children: t2(
                  `Add a real catalog product to this simulated workspace.`,
                  `\uC2E4\uC81C \uCE74\uD0C8\uB85C\uADF8 \uC0C1\uD488\uC744 \uBAA8\uC758 \uC791\uC5C5\uACF5\uAC04\uC5D0 \uCD94\uAC00\uD569\uB2C8\uB2E4.`,
                ),
              }),
              (0, jsxRuntime.jsxs)(`form`, {
                onSubmit: Se2,
                children: [
                  (0, jsxRuntime.jsx)(`label`, {
                    htmlFor: `sd-product`,
                    children: t2(`Product`, `\uC0C1\uD488`),
                  }),
                  (0, jsxRuntime.jsx)(`select`, {
                    id: `sd-product`,
                    value: y2,
                    onChange: (e3) => {
                      (b2(e3.target.value),
                        C2(
                          products.find((t3) => t3.id === e3.target.value)
                            ?.productUrl ?? ``,
                        ));
                    },
                    children: products.map((e3) =>
                      (0, jsxRuntime.jsxs)(
                        `option`,
                        {
                          value: e3.id,
                          children: [
                            e3.name,
                            o2.includes(e3.id)
                              ? t2(
                                  ` \xB7 connected`,
                                  ` \xB7 \uC5F0\uACB0\uB428`,
                                )
                              : ``,
                          ],
                        },
                        e3.id,
                      ),
                    ),
                  }),
                  (0, jsxRuntime.jsx)(`label`, {
                    htmlFor: `sd-url`,
                    children: t2(
                      `Commerce URL`,
                      `\uD310\uB9E4 \uD398\uC774\uC9C0 URL`,
                    ),
                  }),
                  (0, jsxRuntime.jsx)(`input`, {
                    id: `sd-url`,
                    type: `url`,
                    value: S2,
                    onChange: (e3) => C2(e3.target.value),
                    required: true,
                  }),
                  D2 &&
                    (0, jsxRuntime.jsx)(`span`, {
                      className: `sd-form-error`,
                      children: D2,
                    }),
                  (0, jsxRuntime.jsx)(`small`, {
                    children: t2(
                      `Demo registration only. The URL is not crawled and no store connection is created.`,
                      `\uB370\uBAA8 \uB4F1\uB85D\uB9CC \uC9C4\uD589\uD569\uB2C8\uB2E4. URL\uC744 \uC218\uC9D1\uD558\uAC70\uB098 \uC2E4\uC81C \uC1FC\uD551\uBAB0\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`,
                    ),
                  }),
                  (0, jsxRuntime.jsxs)(`button`, {
                    type: `submit`,
                    children: [
                      t2(
                        `Add to my products`,
                        `\uB0B4 \uC0C1\uD488\uC5D0 \uCD94\uAC00`,
                      ),
                      (0, jsxRuntime.jsx)(ArrowRightIcon, { size: 16 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          (0, jsxRuntime.jsx)(`dialog`, {
            ref: M2,
            className: `sd-dialog sd-campaign-dialog`,
            onCancel: () => m2(null),
            onClose: () => m2(null),
            children:
              $2 &&
              (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                children: [
                  (0, jsxRuntime.jsxs)(`div`, {
                    className: `sd-dialog-heading`,
                    children: [
                      (0, jsxRuntime.jsx)(`span`, {
                        className: `sd-soft-badge`,
                        children: t2(
                          `Demo campaign \xB7 simulated attribution`,
                          `\uB370\uBAA8 \uCEA0\uD398\uC778 \xB7 \uBAA8\uC758 \uAE30\uC5EC\uB3C4`,
                        ),
                      }),
                      (0, jsxRuntime.jsx)(`button`, {
                        onClick: () => m2(null),
                        "aria-label": t2(`Close`, `\uB2EB\uAE30`),
                        children: (0, jsxRuntime.jsx)(CloseIcon, { size: 19 }),
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`span`, {
                    className: `sd-detail-platform`,
                    style: { color: $2.color },
                    children: [$2.mark, ` `, $2.id],
                  }),
                  (0, jsxRuntime.jsx)(`h2`, {
                    children: e2 === `en` ? $2.title : $2.titleKo,
                  }),
                  (0, jsxRuntime.jsxs)(`p`, {
                    children: [
                      t2(
                        `A fictional content example for`,
                        `\uAC00\uC0C1 \uCF58\uD150\uCE20 \uC608\uC2DC \uC0C1\uD488:`,
                      ),
                      ` `,
                      (0, jsxRuntime.jsx)(`strong`, { children: P2.name }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`div`, {
                    className: `sd-detail-product`,
                    children: [
                      (0, jsxRuntime.jsx)(`img`, {
                        src: P2.image,
                        alt: P2.name,
                      }),
                      (0, jsxRuntime.jsxs)(`div`, {
                        children: [
                          (0, jsxRuntime.jsx)(`span`, {
                            children:
                              $2.kind === `burst`
                                ? t2(
                                    `A fast spike, then a softer tail.`,
                                    `\uBE60\uB974\uAC8C \uD130\uC9C4 \uD6C4 \uC644\uB9CC\uD574\uC9C4 \uAD00\uC2EC.`,
                                  )
                                : t2(
                                    `Useful content that keeps being found.`,
                                    `\uACC4\uC18D \uAC80\uC0C9\uB418\uACE0 \uBC1C\uACAC\uB418\uB294 \uC720\uC6A9\uD55C \uCF58\uD150\uCE20.`,
                                  ),
                          }),
                          (0, jsxRuntime.jsx)(`p`, {
                            children:
                              $2.kind === `burst`
                                ? t2(
                                    `Use the burst to learn which hook attracts attention. Follow it with a deeper review that answers purchase questions.`,
                                    `\uAE09\uC99D\uD558\uB294 \uAD00\uC2EC\uC5D0\uC11C \uC5B4\uB5A4 \uB9E4\uB825\uC774 \uD1B5\uD558\uB294\uC9C0 \uBC30\uC6B0\uACE0, \uAD6C\uB9E4 \uC804 \uC9C8\uBB38\uC5D0 \uB2F5\uD558\uB294 \uC0C1\uC138 \uB9AC\uBDF0\uB85C \uC774\uC5B4\uAC00\uC138\uC694.`,
                                  )
                                : t2(
                                    `Give shoppers a review they can find later: specific comparisons, practical details and a clear product link.`,
                                    `\uB098\uC911\uC5D0\uB3C4 \uCC3E\uC744 \uC218 \uC788\uB294 \uB9AC\uBDF0\uB97C \uB9CC\uB4DC\uC138\uC694. \uAD6C\uCCB4\uC801\uC778 \uBE44\uAD50, \uC2E4\uC6A9\uC801\uC778 \uB514\uD14C\uC77C, \uBA85\uD655\uD55C \uC0C1\uD488 \uB9C1\uD06C\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.`,
                                  ),
                          }),
                        ],
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsxs)(`div`, {
                    className: `sd-detail-metrics`,
                    children: [
                      (0, jsxRuntime.jsxs)(`span`, {
                        children: [
                          (0, jsxRuntime.jsx)(`strong`, {
                            children: formatRevenue($2.views),
                          }),
                          t2(`views`, `\uC870\uD68C`),
                        ],
                      }),
                      (0, jsxRuntime.jsxs)(`span`, {
                        children: [
                          (0, jsxRuntime.jsx)(`strong`, {
                            children: $2.orders,
                          }),
                          t2(`orders`, `\uC8FC\uBB38`),
                        ],
                      }),
                      (0, jsxRuntime.jsxs)(`span`, {
                        children: [
                          (0, jsxRuntime.jsx)(`strong`, {
                            children: getReasons($2.revenue),
                          }),
                          t2(`revenue`, `\uB9E4\uCD9C`),
                        ],
                      }),
                    ],
                  }),
                  (0, jsxRuntime.jsx)(`p`, {
                    className: `sd-detail-disclaimer`,
                    children: t2(
                      `All performance numbers are synthetic demo fixtures. This title is fictional and is not attributed to any real creator. No purchase attribution or sales lift has been measured.`,
                      `\uBAA8\uB4E0 \uC131\uACFC \uC218\uCE58\uB294 \uBAA8\uC758 \uB370\uC774\uD130\uC785\uB2C8\uB2E4. \uC774 \uC81C\uBAA9\uC740 \uAC00\uC0C1\uC774\uBA70 \uC2E4\uC81C \uD06C\uB9AC\uC5D0\uC774\uD130\uC758 \uCF58\uD150\uCE20\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uAD6C\uB9E4 \uAE30\uC5EC\uB3C4\uB098 \uB9E4\uCD9C \uC99D\uAC00\uB97C \uC2E4\uC81C\uB85C \uCE21\uC815\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.`,
                    ),
                  }),
                  (0, jsxRuntime.jsxs)(`button`, {
                    className: `sd-detail-cta`,
                    onClick: () => {
                      (m2(null),
                        N2.current?.scrollIntoView({ behavior: `smooth` }));
                    },
                    children: [
                      t2(
                        `Find a creator for the next story`,
                        `\uB2E4\uC74C \uC774\uC57C\uAE30\uB97C \uC804\uD560 \uD06C\uB9AC\uC5D0\uC774\uD130 \uCC3E\uAE30`,
                      ),
                      (0, jsxRuntime.jsx)(ArrowRightIcon, { size: 16 }),
                    ],
                  }),
                ],
              }),
          }),
        ],
      })
    : null;
}

function ExternalArrow() {
  return (0, jsxRuntime.jsx)(ArrowUpRightIcon, { size: 15 });
}

export { SellerStudio, ExternalArrow };
