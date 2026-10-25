import * as React from "react";

const joinClasses = (...e2) =>
  e2
    .filter((e3, t2, n2) => !!e3 && e3.trim() !== `` && n2.indexOf(e3) === t2)
    .join(` `)
    .trim();

const toKebabCase = (e2) =>
  e2.replace(/([a-z0-9])([A-Z])/g, `$1-$2`).toLowerCase();

const toCamelCase = (e2) =>
  e2.replace(/^([A-Z])|[\s-_]+(\w)/g, (e3, t2, n2) =>
    n2 ? n2.toUpperCase() : t2.toLowerCase(),
  );

const toPascalCase = (e2) => {
  let t2 = toCamelCase(e2);
  return t2.charAt(0).toUpperCase() + t2.slice(1);
};

const defaultSvgAttributes = {
  xmlns: `http://www.w3.org/2000/svg`,
  width: 24,
  height: 24,
  viewBox: `0 0 24 24`,
  fill: `none`,
  stroke: `currentColor`,
  strokeWidth: 2,
  strokeLinecap: `round`,
  strokeLinejoin: `round`,
};

const hasAccessibleName = (e2) => {
  for (let t2 in e2)
    if (t2.startsWith(`aria-`) || t2 === `role` || t2 === `title`) return true;
  return false;
};

const IconContext = (0, React.createContext)({});

const useIconContext = () => (0, React.useContext)(IconContext);

const Icon = (0, React.forwardRef)(
  (
    {
      color: e2,
      size: t2,
      strokeWidth: n2,
      absoluteStrokeWidth: r2,
      className: a2 = ``,
      children: o2,
      iconNode: s2,
      ...d2
    },
    p2,
  ) => {
    let {
        size: m2 = 24,
        strokeWidth: h2 = 2,
        absoluteStrokeWidth: g2 = false,
        color: _2 = `currentColor`,
        className: v2 = ``,
      } = useIconContext() ?? {},
      y2 = (r2 ?? g2) ? (Number(n2 ?? h2) * 24) / Number(t2 ?? m2) : (n2 ?? h2);
    return (0, React.createElement)(
      `svg`,
      {
        ref: p2,
        ...defaultSvgAttributes,
        width: t2 ?? m2 ?? defaultSvgAttributes.width,
        height: t2 ?? m2 ?? defaultSvgAttributes.height,
        stroke: e2 ?? _2,
        strokeWidth: y2,
        className: joinClasses(`lucide`, v2, a2),
        ...(!o2 && !hasAccessibleName(d2) && { "aria-hidden": `true` }),
        ...d2,
      },
      [
        ...s2.map(([e3, t3]) => (0, React.createElement)(e3, t3)),
        ...(Array.isArray(o2) ? o2 : [o2]),
      ],
    );
  },
);

const createIcon = (e2, t2) => {
  let n2 = (0, React.forwardRef)(({ className: n3, ...r2 }, o2) =>
    (0, React.createElement)(Icon, {
      ref: o2,
      iconNode: t2,
      className: joinClasses(
        `lucide-${toKebabCase(toPascalCase(e2))}`,
        `lucide-${e2}`,
        n3,
      ),
      ...r2,
    }),
  );
  return ((n2.displayName = toPascalCase(e2)), n2);
};

const ArrowDownUpIcon = createIcon(`arrow-down-up`, [
  [`path`, { d: `m3 16 4 4 4-4`, key: `1co6wj` }],
  [`path`, { d: `M7 20V4`, key: `1yoxec` }],
  [`path`, { d: `m21 8-4-4-4 4`, key: `1c9v7m` }],
  [`path`, { d: `M17 4v16`, key: `7dpous` }],
]);

const ArrowRightIcon = createIcon(`arrow-right`, [
  [`path`, { d: `M5 12h14`, key: `1ays0h` }],
  [`path`, { d: `m12 5 7 7-7 7`, key: `xquz4c` }],
]);

const ArrowUpRightIcon = createIcon(`arrow-up-right`, [
  [`path`, { d: `M7 7h10v10`, key: `1tivn9` }],
  [`path`, { d: `M7 17 17 7`, key: `1vkiza` }],
]);

const BookmarkIcon = createIcon(`bookmark`, [
  [
    `path`,
    {
      d: `M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z`,
      key: `oz39mx`,
    },
  ],
]);

const ChartColumnIcon = createIcon(`chart-column`, [
  [`path`, { d: `M3 3v16a2 2 0 0 0 2 2h16`, key: `c24i48` }],
  [`path`, { d: `M18 17V9`, key: `2bz60n` }],
  [`path`, { d: `M13 17V5`, key: `1frdt8` }],
  [`path`, { d: `M8 17v-3`, key: `17ska0` }],
]);

const CheckCheckIcon = createIcon(`check-check`, [
  [`path`, { d: `M18 6 7 17l-5-5`, key: `116fxf` }],
  [`path`, { d: `m22 10-7.5 7.5L13 16`, key: `ke71qq` }],
]);

const CheckIcon = createIcon(`check`, [
  [`path`, { d: `M20 6 9 17l-5-5`, key: `1gmf2c` }],
]);

const ChevronDownIcon = createIcon(`chevron-down`, [
  [`path`, { d: `m6 9 6 6 6-6`, key: `qrunsl` }],
]);

const ClockIcon = createIcon(`clock-3`, [
  [`circle`, { cx: `12`, cy: `12`, r: `10`, key: `1mglay` }],
  [`path`, { d: `M12 6v6h4`, key: `135r8i` }],
]);

const ExternalLinkIcon = createIcon(`external-link`, [
  [`path`, { d: `M15 3h6v6`, key: `1q9fwt` }],
  [`path`, { d: `M10 14 21 3`, key: `gplh6r` }],
  [
    `path`,
    {
      d: `M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6`,
      key: `a6xqqp`,
    },
  ],
]);

const FlameIcon = createIcon(`flame`, [
  [
    `path`,
    {
      d: `M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4`,
      key: `1slcih`,
    },
  ],
]);

const GridIcon = createIcon(`grid-2x2`, [
  [`path`, { d: `M12 3v18`, key: `108xh3` }],
  [`path`, { d: `M3 12h18`, key: `1i2n21` }],
  [
    `rect`,
    { x: `3`, y: `3`, width: `18`, height: `18`, rx: `2`, key: `h1oib` },
  ],
]);

const HeartIcon = createIcon(`heart`, [
  [
    `path`,
    {
      d: `M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5`,
      key: `mvr1a0`,
    },
  ],
]);

const DashboardIcon = createIcon(`layout-dashboard`, [
  [`rect`, { width: `7`, height: `9`, x: `3`, y: `3`, rx: `1`, key: `10lvy0` }],
  [
    `rect`,
    { width: `7`, height: `5`, x: `14`, y: `3`, rx: `1`, key: `16une8` },
  ],
  [
    `rect`,
    { width: `7`, height: `9`, x: `14`, y: `12`, rx: `1`, key: `1hutg5` },
  ],
  [
    `rect`,
    { width: `7`, height: `5`, x: `3`, y: `16`, rx: `1`, key: `ldoo1y` },
  ],
]);

const LinkIcon = createIcon(`link-2`, [
  [`path`, { d: `M9 17H7A5 5 0 0 1 7 7h2`, key: `8i5ue5` }],
  [`path`, { d: `M15 7h2a5 5 0 1 1 0 10h-2`, key: `1b9ql8` }],
  [`line`, { x1: `8`, x2: `16`, y1: `12`, y2: `12`, key: `1jonct` }],
]);

const MonitorIcon = createIcon(`monitor`, [
  [
    `rect`,
    { width: `20`, height: `14`, x: `2`, y: `3`, rx: `2`, key: `48i651` },
  ],
  [`line`, { x1: `8`, x2: `16`, y1: `21`, y2: `21`, key: `1svkeh` }],
  [`line`, { x1: `12`, x2: `12`, y1: `17`, y2: `21`, key: `vw1qmm` }],
]);

const PlayIcon = createIcon(`play`, [
  [
    `path`,
    {
      d: `M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z`,
      key: `10ikf1`,
    },
  ],
]);

const PlusIcon = createIcon(`plus`, [
  [`path`, { d: `M5 12h14`, key: `1ays0h` }],
  [`path`, { d: `M12 5v14`, key: `s699le` }],
]);

const HistoryIcon = createIcon(`rotate-ccw-clock`, [
  [
    `path`,
    { d: `M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`, key: `1357e3` },
  ],
  [`path`, { d: `M3 3v5h5`, key: `1xhq8a` }],
  [`path`, { d: `M12 7v5l4 2`, key: `1fdv2h` }],
]);

const ResetIcon = createIcon(`rotate-ccw`, [
  [
    `path`,
    { d: `M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`, key: `1357e3` },
  ],
  [`path`, { d: `M3 3v5h5`, key: `1xhq8a` }],
]);

const SearchIcon = createIcon(`search`, [
  [`path`, { d: `m21 21-4.34-4.34`, key: `14j7rj` }],
  [`circle`, { cx: `11`, cy: `11`, r: `8`, key: `4ej97u` }],
]);

const ShieldCheckIcon = createIcon(`shield-check`, [
  [
    `path`,
    {
      d: `M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z`,
      key: `oel41y`,
    },
  ],
  [`path`, { d: `m9 12 2 2 4-4`, key: `dzmm74` }],
]);

const ShoppingBagIcon = createIcon(`shopping-bag`, [
  [`path`, { d: `M16 10a4 4 0 0 1-8 0`, key: `1ltviw` }],
  [`path`, { d: `M3.103 6.034h17.794`, key: `awc11p` }],
  [
    `path`,
    {
      d: `M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z`,
      key: `o988cm`,
    },
  ],
]);

const SparklesIcon = createIcon(`sparkles`, [
  [
    `path`,
    {
      d: `M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z`,
      key: `1s2grr`,
    },
  ],
  [`path`, { d: `M20 2v4`, key: `1rf3ol` }],
  [`path`, { d: `M22 4h-4`, key: `gwowj6` }],
  [`circle`, { cx: `4`, cy: `20`, r: `2`, key: `6kqj1y` }],
]);

const TrendingUpIcon = createIcon(`trending-up`, [
  [`path`, { d: `M16 7h6v6`, key: `box55l` }],
  [`path`, { d: `m22 7-8.5 8.5-5-5L2 17`, key: `1t1m79` }],
]);

const CloseIcon = createIcon(`x`, [
  [`path`, { d: `M18 6 6 18`, key: `1bl5f8` }],
  [`path`, { d: `m6 6 12 12`, key: `d8bk6v` }],
]);

export {
  joinClasses,
  toKebabCase,
  toCamelCase,
  toPascalCase,
  defaultSvgAttributes,
  hasAccessibleName,
  IconContext,
  useIconContext,
  Icon,
  createIcon,
  ArrowDownUpIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BookmarkIcon,
  ChartColumnIcon,
  CheckCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  ExternalLinkIcon,
  FlameIcon,
  GridIcon,
  HeartIcon,
  DashboardIcon,
  LinkIcon,
  MonitorIcon,
  PlayIcon,
  PlusIcon,
  HistoryIcon,
  ResetIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TrendingUpIcon,
  CloseIcon,
};
