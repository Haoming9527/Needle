import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import {
  rankCreators,
  creators,
  creatorVideos,
  scoreProductMatch,
  videoAgeDays,
  snapshotDate,
} from "../data/creators.js";
import {
  SparklesIcon,
  ShieldCheckIcon,
  SearchIcon,
  FlameIcon,
  CheckIcon,
  BookmarkIcon,
  PlayIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
} from "../icons.js";

const matchLabels = {
  "exact-review": [
    `Exact product review`,
    `\uB3D9\uC77C \uC0C1\uD488 \uB9AC\uBDF0`,
  ],
  "exact-mention": [
    `Exact product featured`,
    `\uB3D9\uC77C \uC0C1\uD488 \uB4F1\uC7A5`,
  ],
  "category-review": [
    `Related category review`,
    `\uAD00\uB828 \uCE74\uD14C\uACE0\uB9AC \uB9AC\uBDF0`,
  ],
  category: [`Related context`, `\uAD00\uB828 \uC0AC\uC6A9 \uB9E5\uB77D`],
  unrelated: [
    `No product evidence`,
    `\uC0C1\uD488 \uC77C\uCE58 \uADFC\uAC70 \uC5C6\uC74C`,
  ],
  missing: [
    `No verified video yet`,
    `\uD655\uC778\uB41C \uC601\uC0C1 \uC5C6\uC74C`,
  ],
};

const compactNumber = (e2) =>
  new Intl.NumberFormat(`en-US`, {
    notation: `compact`,
    maximumFractionDigits: 1,
  }).format(e2);

function CreatorAvatar(e2, t2) {
  return e2.publishedAt
    ? new Date(e2.publishedAt).toLocaleDateString(
        t2 === `en` ? `en-GB` : `ko-KR`,
        { year: `numeric`, month: `short`, day: `numeric`, timeZone: `UTC` },
      )
    : t2 === `en`
      ? `Upload date unavailable`
      : `\uC5C5\uB85C\uB4DC \uB0A0\uC9DC \uBBF8\uD655\uC778`;
}

function CreatorMatches({
  product: e2,
  lang: t2,
  shortlist: n2,
  onToggle: r2,
}) {
  let [i2, a2] = (0, React.useState)(`all`),
    [o2, s2] = (0, React.useState)(`match`),
    [c2, l2] = (0, React.useState)(false),
    d2 = (e3, n3) => (t2 === `en` ? e3 : n3),
    f2 = rankCreators(e2, creators, creatorVideos),
    p2 = f2.filter(
      (e3) =>
        i2 === `all` ||
        (i2 === `exact`
          ? e3.exact && e3.video?.isProductReview
          : n2.includes(e3.creator.id)),
    ),
    m2 = c2 ? p2 : p2.slice(0, 4),
    h2 = f2.filter((e3) => e3.kind === `exact-review`).length;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `cm-workspace`,
    children: [
      (0, jsxRuntime.jsxs)(`div`, {
        className: `cm-heading`,
        children: [
          (0, jsxRuntime.jsxs)(`div`, {
            children: [
              (0, jsxRuntime.jsxs)(`span`, {
                className: `cm-eyebrow`,
                children: [
                  (0, jsxRuntime.jsx)(SparklesIcon, { size: 14 }),
                  d2(
                    `CREATOR DISCOVERY`,
                    `\uD06C\uB9AC\uC5D0\uC774\uD130 \uB514\uC2A4\uCEE4\uBC84\uB9AC`,
                  ),
                ],
              }),
              (0, jsxRuntime.jsxs)(`h2`, {
                children: [
                  d2(
                    `The right video.`,
                    `\uB9DE\uB294 \uC601\uC0C1\uC5D0\uC11C,`,
                  ),
                  (0, jsxRuntime.jsx)(`br`, {}),
                  (0, jsxRuntime.jsx)(`em`, {
                    children: d2(
                      `Your next creator.`,
                      `\uB2E4\uC74C \uD06C\uB9AC\uC5D0\uC774\uD130\uB85C.`,
                    ),
                  }),
                ],
              }),
              (0, jsxRuntime.jsx)(`p`, {
                children: d2(
                  `Start with proof of product fit. Then look at what is getting attention.`,
                  `\uC0C1\uD488 \uC77C\uCE58 \uADFC\uAC70\uB97C \uBA3C\uC800 \uD655\uC778\uD558\uACE0, \uCD5C\uADFC \uC8FC\uBAA9\uBC1B\uC740 \uC601\uC0C1\uAE4C\uC9C0 \uBE44\uAD50\uD558\uC138\uC694.`,
                ),
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `cm-product-context`,
            children: [
              (0, jsxRuntime.jsx)(`img`, { src: e2.image, alt: e2.name }),
              (0, jsxRuntime.jsxs)(`div`, {
                children: [
                  (0, jsxRuntime.jsx)(`small`, {
                    children: d2(
                      `MATCHING FOR`,
                      `\uB9E4\uCE6D \uC911\uC778 \uC0C1\uD488`,
                    ),
                  }),
                  (0, jsxRuntime.jsxs)(`strong`, {
                    children: [e2.brand, ` `, e2.name],
                  }),
                  (0, jsxRuntime.jsx)(`span`, {
                    children: h2
                      ? d2(
                          `${h2} ${h2 === 1 ? `creator` : `creators`} with exact-product reviews`,
                          `\uB3D9\uC77C \uC0C1\uD488 \uB9AC\uBDF0 \uD06C\uB9AC\uC5D0\uC774\uD130 ${h2}\uBA85`,
                        )
                      : d2(
                          `No exact-product review in this sample`,
                          `\uC774 \uC0D8\uD50C\uC5D0 \uB3D9\uC77C \uC0C1\uD488 \uB9AC\uBDF0 \uC5C6\uC74C`,
                        ),
                  }),
                ],
              }),
              (0, jsxRuntime.jsx)(`span`, { className: `cm-live-dot` }),
            ],
          }),
        ],
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `cm-explainer`,
        children: [
          (0, jsxRuntime.jsx)(ShieldCheckIcon, { size: 18 }),
          (0, jsxRuntime.jsxs)(`span`, {
            children: [
              d2(
                `Product review first. Popularity second.`,
                `\uB3D9\uC77C \uC0C1\uD488 \uB9AC\uBDF0 \uC6B0\uC120. \uC778\uAE30\uB3C4\uB294 \uADF8\uB2E4\uC74C.`,
              ),
              ` `,
              (0, jsxRuntime.jsx)(`small`, {
                children: d2(
                  `Real videos \xB7 sampled public data \xB7 illustrative match scores`,
                  `\uC2E4\uC81C \uC601\uC0C1 \xB7 \uC218\uC9D1\uD55C \uACF5\uAC1C \uC815\uBCF4 \xB7 \uC608\uC2DC \uC77C\uCE58\uB3C4`,
                ),
              }),
            ],
          }),
          (0, jsxRuntime.jsxs)(`details`, {
            children: [
              (0, jsxRuntime.jsx)(`summary`, {
                children: d2(`How we rank`, `\uCD94\uCC9C \uAE30\uC900`),
              }),
              (0, jsxRuntime.jsx)(`p`, {
                children: d2(
                  `Same-product reviews rank above product appearances, category reviews and general lifestyle content. Verified views and recency only break ties within a relevance band. The recent pick uses views/day among sampled uploads from the last 90 days when data is available. This is a transparent demo rule, not a trained AI result or a complete channel audit.`,
                  `\uB3D9\uC77C \uC0C1\uD488 \uB9AC\uBDF0 \u2192 \uC0C1\uD488 \uB4F1\uC7A5 \u2192 \uAC19\uC740 \uCE74\uD14C\uACE0\uB9AC \uB9AC\uBDF0 \u2192 \uC77C\uBC18 \uB9E5\uB77D \uC21C\uC73C\uB85C \uCD94\uCC9C\uD569\uB2C8\uB2E4. \uD655\uC778\uB41C \uC870\uD68C\uC218\uC640 \uCD5C\uC2E0\uC131\uC740 \uAC19\uC740 \uC77C\uCE58\uB3C4 \uB4F1\uAE09 \uC548\uC5D0\uC11C\uB9CC \uBC18\uC601\uD569\uB2C8\uB2E4. \uCD5C\uADFC \uC601\uC0C1\uC740 \uC218\uC9D1\uD55C \uCD5C\uADFC 90\uC77C \uC601\uC0C1 \uC911 \uC77C\uD3C9\uADE0 \uC870\uD68C\uB85C \uACE0\uB985\uB2C8\uB2E4. \uD559\uC2B5\uB41C AI \uACB0\uACFC\uB098 \uC804\uCCB4 \uCC44\uB110 \uBD84\uC11D\uC774 \uC544\uB2CC \uACF5\uAC1C \uC815\uBCF4 \uAE30\uBC18 \uB370\uBAA8 \uADDC\uCE59\uC785\uB2C8\uB2E4.`,
                ),
              }),
            ],
          }),
        ],
      }),
      (0, jsxRuntime.jsxs)(`div`, {
        className: `cm-toolbar`,
        children: [
          (0, jsxRuntime.jsx)(`div`, {
            className: `cm-filter`,
            "aria-label": d2(
              `Creator filter`,
              `\uD06C\uB9AC\uC5D0\uC774\uD130 \uD544\uD130`,
            ),
            children: [`all`, `exact`, `saved`].map((e3) =>
              (0, jsxRuntime.jsx)(
                `button`,
                {
                  className: i2 === e3 ? `active` : ``,
                  onClick: () => {
                    (a2(e3), l2(false));
                  },
                  children:
                    e3 === `all`
                      ? d2(`All creators`, `\uC804\uCCB4`)
                      : e3 === `exact`
                        ? d2(
                            `With exact reviews`,
                            `\uB3D9\uC77C \uC0C1\uD488 \uB9AC\uBDF0 \uBCF4\uC720`,
                          )
                        : d2(
                            `Shortlist \xB7 ${n2.length}`,
                            `\uC800\uC7A5\uD55C \uD6C4\uBCF4 \xB7 ${n2.length}`,
                          ),
                },
                e3,
              ),
            ),
          }),
          (0, jsxRuntime.jsxs)(`div`, {
            className: `cm-mode`,
            children: [
              (0, jsxRuntime.jsxs)(`button`, {
                className: o2 === `match` ? `active` : ``,
                onClick: () => s2(`match`),
                children: [
                  (0, jsxRuntime.jsx)(SearchIcon, { size: 13 }),
                  d2(
                    `Best product match`,
                    `\uC0C1\uD488 \uC77C\uCE58 \uC601\uC0C1`,
                  ),
                ],
              }),
              (0, jsxRuntime.jsxs)(`button`, {
                className: o2 === `recent` ? `active` : ``,
                onClick: () => s2(`recent`),
                children: [
                  (0, jsxRuntime.jsx)(FlameIcon, { size: 13 }),
                  d2(
                    `Recent standout`,
                    `\uCD5C\uADFC \uC8FC\uBAA9 \uC601\uC0C1`,
                  ),
                ],
              }),
            ],
          }),
        ],
      }),
      (0, jsxRuntime.jsx)(`div`, {
        className: `cm-grid`,
        children: m2.map((i3) => {
          let a3 = o2 === `recent` ? i3.recentVideo : i3.video,
            s3 = scoreProductMatch(e2, a3),
            c3 = a3 && videoAgeDays(a3);
          return (0, jsxRuntime.jsxs)(
            `article`,
            {
              className: `cm-card`,
              children: [
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `cm-card-head`,
                  children: [
                    (0, jsxRuntime.jsx)(`img`, {
                      className: `cm-avatar`,
                      src: i3.creator.avatar,
                      alt: i3.creator.name,
                    }),
                    (0, jsxRuntime.jsxs)(`div`, {
                      children: [
                        (0, jsxRuntime.jsx)(`h3`, {
                          children: i3.creator.name,
                        }),
                        (0, jsxRuntime.jsxs)(`span`, {
                          children: [
                            `Singapore \xB7 `,
                            t2 === `en` ? i3.creator.niche : i3.creator.nicheKo,
                          ],
                        }),
                      ],
                    }),
                    (0, jsxRuntime.jsx)(`button`, {
                      className: n2.includes(i3.creator.id) ? `saved` : ``,
                      "aria-label": d2(
                        `Shortlist ${i3.creator.name}`,
                        `${i3.creator.name} \uD6C4\uBCF4 \uC800\uC7A5`,
                      ),
                      "aria-pressed": n2.includes(i3.creator.id),
                      onClick: () => r2(i3.creator),
                      children: n2.includes(i3.creator.id)
                        ? (0, jsxRuntime.jsx)(CheckIcon, { size: 17 })
                        : (0, jsxRuntime.jsx)(BookmarkIcon, { size: 17 }),
                    }),
                  ],
                }),
                a3
                  ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                      children: [
                        (0, jsxRuntime.jsxs)(`a`, {
                          className: `cm-video`,
                          href: a3.url,
                          target: `_blank`,
                          rel: `noreferrer`,
                          "aria-label": d2(
                            `Watch ${a3.title}`,
                            `${a3.title} \uBCF4\uAE30`,
                          ),
                          children: [
                            (0, jsxRuntime.jsx)(`img`, {
                              src: a3.thumbnail,
                              alt: a3.title,
                              loading: `lazy`,
                            }),
                            (0, jsxRuntime.jsx)(`span`, {
                              className: `cm-video-shade`,
                            }),
                            (0, jsxRuntime.jsx)(`span`, {
                              className: `cm-video-tag`,
                              children:
                                o2 === `recent`
                                  ? i3.hasRecentMetrics
                                    ? (0, jsxRuntime.jsxs)(
                                        jsxRuntime.Fragment,
                                        {
                                          children: [
                                            (0, jsxRuntime.jsx)(FlameIcon, {
                                              size: 12,
                                            }),
                                            d2(
                                              `RECENT PICK \xB7 SAMPLE`,
                                              `\uCD5C\uADFC \uC8FC\uBAA9 \xB7 \uC0D8\uD50C`,
                                            ),
                                          ],
                                        },
                                      )
                                    : d2(
                                        `LATEST SAMPLED VIDEO`,
                                        `\uC218\uC9D1\uD55C \uCD5C\uC2E0 \uC601\uC0C1`,
                                      )
                                  : s3.kind === `exact-review`
                                    ? d2(
                                        `PRODUCT REVIEW EVIDENCE`,
                                        `\uC0C1\uD488 \uC77C\uCE58 \uADFC\uAC70`,
                                      )
                                    : d2(
                                        `CREATOR VIDEO`,
                                        `\uD06C\uB9AC\uC5D0\uC774\uD130 \uC601\uC0C1`,
                                      ),
                            }),
                            (0, jsxRuntime.jsx)(`span`, {
                              className: `cm-play`,
                              children: (0, jsxRuntime.jsx)(PlayIcon, {
                                size: 20,
                                fill: `currentColor`,
                              }),
                            }),
                            (0, jsxRuntime.jsxs)(`span`, {
                              className: `cm-watch`,
                              children: [
                                `YouTube `,
                                (0, jsxRuntime.jsx)(ArrowUpRightIcon, {
                                  size: 13,
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, jsxRuntime.jsxs)(`div`, {
                          className: `cm-video-body`,
                          children: [
                            (0, jsxRuntime.jsxs)(`div`, {
                              className: `cm-video-stats`,
                              children: [
                                (0, jsxRuntime.jsx)(`span`, {
                                  children: CreatorAvatar(a3, t2),
                                }),
                                (0, jsxRuntime.jsx)(`span`, {
                                  children:
                                    a3.verifiedViews == null
                                      ? d2(
                                          `Views not verified`,
                                          `\uC870\uD68C\uC218 \uBBF8\uD655\uC778`,
                                        )
                                      : `${compactNumber(a3.verifiedViews)} ${d2(`views \xB7 snapshot`, `\uC870\uD68C \xB7 \uC218\uC9D1 \uC2DC\uC810`)}`,
                                }),
                              ],
                            }),
                            (0, jsxRuntime.jsxs)(`a`, {
                              className: `cm-video-title`,
                              href: a3.url,
                              target: `_blank`,
                              rel: `noreferrer`,
                              children: [
                                a3.title,
                                (0, jsxRuntime.jsx)(ArrowUpRightIcon, {
                                  size: 16,
                                }),
                              ],
                            }),
                            (0, jsxRuntime.jsxs)(`div`, {
                              className: `cm-match ${s3.exact ? `exact` : ``}`,
                              children: [
                                (0, jsxRuntime.jsxs)(`div`, {
                                  children: [
                                    (0, jsxRuntime.jsx)(`span`, {
                                      children:
                                        matchLabels[s3.kind][
                                          t2 === `en` ? 0 : 1
                                        ],
                                    }),
                                    (0, jsxRuntime.jsx)(`small`, {
                                      children: d2(
                                        `Illustrative product match`,
                                        `\uC608\uC2DC \uC0C1\uD488 \uC77C\uCE58\uB3C4`,
                                      ),
                                    }),
                                  ],
                                }),
                                (0, jsxRuntime.jsxs)(`strong`, {
                                  children: [
                                    s3.score,
                                    (0, jsxRuntime.jsx)(`small`, {
                                      children: `/100`,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            (0, jsxRuntime.jsxs)(`p`, {
                              className: `cm-evidence`,
                              children: [
                                s3.exact
                                  ? (0, jsxRuntime.jsx)(CheckIcon, { size: 14 })
                                  : (0, jsxRuntime.jsx)(SearchIcon, {
                                      size: 14,
                                    }),
                                (0, jsxRuntime.jsx)(`span`, {
                                  children:
                                    t2 === `en` ? a3.evidence : a3.evidenceKo,
                                }),
                              ],
                            }),
                            c3 != null &&
                              c3 > 90 &&
                              (0, jsxRuntime.jsx)(`small`, {
                                className: `cm-archive`,
                                children: d2(
                                  `Archive reference \xB7 not a recent upload`,
                                  `\uACFC\uAC70 \uC601\uC0C1 \uCC38\uACE0 \xB7 \uCD5C\uADFC \uC5C5\uB85C\uB4DC \uC544\uB2D8`,
                                ),
                              }),
                            o2 === `match` &&
                              i3.recentVideo &&
                              i3.recentVideo.id !== a3.id &&
                              (0, jsxRuntime.jsxs)(`a`, {
                                className: `cm-recent-link`,
                                href: i3.recentVideo.url,
                                target: `_blank`,
                                rel: `noreferrer`,
                                children: [
                                  (0, jsxRuntime.jsx)(FlameIcon, { size: 15 }),
                                  (0, jsxRuntime.jsxs)(`span`, {
                                    children: [
                                      (0, jsxRuntime.jsx)(`small`, {
                                        children: i3.hasRecentMetrics
                                          ? d2(
                                              `ALSO SEE \xB7 RECENT PICK IN SAMPLE`,
                                              `\uD568\uAED8 \uBCF4\uAE30 \xB7 \uC0D8\uD50C\uC758 \uCD5C\uADFC \uC8FC\uBAA9 \uC601\uC0C1`,
                                            )
                                          : d2(
                                              `ALSO SEE \xB7 LATEST SAMPLED UPLOAD`,
                                              `\uD568\uAED8 \uBCF4\uAE30 \xB7 \uC218\uC9D1\uD55C \uCD5C\uC2E0 \uC601\uC0C1`,
                                            ),
                                      }),
                                      i3.recentVideo.title,
                                    ],
                                  }),
                                  (0, jsxRuntime.jsx)(ArrowUpRightIcon, {
                                    size: 15,
                                  }),
                                ],
                              }),
                          ],
                        }),
                      ],
                    })
                  : (0, jsxRuntime.jsxs)(`div`, {
                      className: `cm-missing`,
                      children: [
                        (0, jsxRuntime.jsx)(SearchIcon, { size: 26 }),
                        (0, jsxRuntime.jsx)(`h4`, {
                          children: d2(
                            `Evidence comes first.`,
                            `\uADFC\uAC70\uAC00 \uBA3C\uC800\uC785\uB2C8\uB2E4.`,
                          ),
                        }),
                        (0, jsxRuntime.jsx)(`p`, {
                          children: d2(
                            `No verified video in this sample. We will not invent a review or a match score.`,
                            `\uC774 \uC0D8\uD50C\uC5D0\uC11C \uD655\uC778\uD55C \uC601\uC0C1\uC774 \uC5C6\uC5B4 \uB9AC\uBDF0\uB098 \uC77C\uCE58\uB3C4\uB97C \uB9CC\uB4E4\uC5B4\uB0B4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`,
                          ),
                        }),
                        (0, jsxRuntime.jsxs)(`a`, {
                          href: i3.creator.profileUrl,
                          target: `_blank`,
                          rel: `noreferrer`,
                          children: [
                            d2(
                              `View creator profile`,
                              `\uD06C\uB9AC\uC5D0\uC774\uD130 \uD504\uB85C\uD544 \uBCF4\uAE30`,
                            ),
                            (0, jsxRuntime.jsx)(ArrowUpRightIcon, { size: 14 }),
                          ],
                        }),
                      ],
                    }),
                (0, jsxRuntime.jsxs)(`div`, {
                  className: `cm-card-footer`,
                  children: [
                    (0, jsxRuntime.jsx)(`span`, {
                      children:
                        i3.kind === `unrelated` || i3.kind === `missing`
                          ? d2(
                              `Explore \xB7 product fit not established`,
                              `\uD0D0\uC0C9 \uD6C4\uBCF4 \xB7 \uC0C1\uD488 \uC801\uD569\uC131 \uBBF8\uD655\uC778`,
                            )
                          : d2(
                              `Recommendation #${f2.indexOf(i3) + 1}`,
                              `\uCD94\uCC9C \uC21C\uC704 #${f2.indexOf(i3) + 1}`,
                            ),
                    }),
                    (0, jsxRuntime.jsxs)(`button`, {
                      onClick: () => r2(i3.creator),
                      children: [
                        n2.includes(i3.creator.id)
                          ? d2(
                              `Shortlisted`,
                              `\uD6C4\uBCF4\uC5D0 \uC800\uC7A5\uB428`,
                            )
                          : d2(
                              `Add to shortlist`,
                              `\uD611\uC5C5 \uD6C4\uBCF4 \uC800\uC7A5`,
                            ),
                        (0, jsxRuntime.jsx)(ArrowUpRightIcon, { size: 14 }),
                      ],
                    }),
                  ],
                }),
              ],
            },
            i3.creator.id,
          );
        }),
      }),
      !p2.length &&
        (0, jsxRuntime.jsxs)(`div`, {
          className: `cm-empty`,
          children: [
            (0, jsxRuntime.jsx)(SearchIcon, { size: 25 }),
            (0, jsxRuntime.jsx)(`h3`, {
              children:
                i2 === `exact`
                  ? d2(
                      `No verified exact-product review yet.`,
                      `\uD655\uC778\uB41C \uB3D9\uC77C \uC0C1\uD488 \uB9AC\uBDF0\uAC00 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.`,
                    )
                  : d2(
                      `Your shortlist starts here.`,
                      `\uD611\uC5C5 \uD6C4\uBCF4\uB97C \uC800\uC7A5\uD574\uBCF4\uC138\uC694.`,
                    ),
            }),
            (0, jsxRuntime.jsx)(`p`, {
              children: d2(
                `Related context is useful, but it is not proof of a product review.`,
                `\uAD00\uB828 \uB9E5\uB77D\uC740 \uCC38\uACE0\uD560 \uC218 \uC788\uC9C0\uB9CC \uC0C1\uD488 \uB9AC\uBDF0\uC758 \uADFC\uAC70\uC640\uB294 \uAD6C\uBD84\uD569\uB2C8\uB2E4.`,
              ),
            }),
            (0, jsxRuntime.jsx)(`button`, {
              onClick: () => a2(`all`),
              children: d2(
                `See all creators`,
                `\uC804\uCCB4 \uD06C\uB9AC\uC5D0\uC774\uD130 \uBCF4\uAE30`,
              ),
            }),
          ],
        }),
      p2.length > 4 &&
        (0, jsxRuntime.jsxs)(`button`, {
          className: `cm-show-more`,
          onClick: () => l2(!c2),
          children: [
            c2
              ? d2(`Show top 4`, `\uC0C1\uC704 4\uBA85 \uBCF4\uAE30`)
              : d2(
                  `Explore all ${p2.length} creators`,
                  `\uD06C\uB9AC\uC5D0\uC774\uD130 ${p2.length}\uBA85 \uBAA8\uB450 \uBCF4\uAE30`,
                ),
            (0, jsxRuntime.jsx)(ChevronDownIcon, { size: 16 }),
          ],
        }),
      (0, jsxRuntime.jsx)(`p`, {
        className: `cm-footnote`,
        children: d2(
          `Public metadata snapshot: ${snapshotDate}. \u201CRecent\u201D compares the sampled set, not every upload. Views may change; match scores are demo rules. Creator appearances do not imply endorsement.`,
          `\uACF5\uAC1C \uC815\uBCF4 \uC218\uC9D1 \uAE30\uC900: ${snapshotDate}. \uCD5C\uADFC \uC8FC\uBAA9 \uC601\uC0C1\uC740 \uC804\uCCB4 \uC5C5\uB85C\uB4DC\uAC00 \uC544\uB2CC \uC218\uC9D1 \uC0D8\uD50C \uAE30\uC900\uC785\uB2C8\uB2E4. \uC870\uD68C\uC218\uB294 \uBC14\uB014 \uC218 \uC788\uC73C\uBA70 \uC77C\uCE58\uB3C4\uB294 \uB370\uBAA8 \uADDC\uCE59\uC785\uB2C8\uB2E4. \uD06C\uB9AC\uC5D0\uC774\uD130\uC758 \uD64D\uBCF4\xB7\uCD94\uCC9C \uC774\uB825\uC744 \uC758\uBBF8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`,
        ),
      }),
    ],
  });
}

export { matchLabels, compactNumber, CreatorAvatar, CreatorMatches };
