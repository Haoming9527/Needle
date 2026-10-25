const campaigns = [
  {
    id: `YouTube`,
    mark: `\u25B6`,
    color: `#d75542`,
    title: `The one thing that changed my daily commute`,
    titleKo: `\uB9E4\uC77C\uC758 \uCD9C\uD1F4\uADFC\uC744 \uBC14\uAFBC \uD55C \uAC00\uC9C0`,
    views: 284600,
    orders: 84,
    shape: [4, 7, 10, 18, 32, 24, 18, 15, 14, 13],
    kind: `steady`,
  },
  {
    id: `Naver Blog`,
    mark: `N`,
    color: `#679d5b`,
    title: `Two weeks later: the details that still matter`,
    titleKo: `2\uC8FC \uC0AC\uC6A9 \uD6C4\uAE30: \uC5EC\uC804\uD788 \uB9CC\uC871\uD558\uB294 \uB514\uD14C\uC77C`,
    views: 24800,
    orders: 39,
    shape: [1, 3, 4, 6, 8, 10, 11, 12, 14, 16],
    kind: `steady`,
  },
  {
    id: `TikTok`,
    mark: `\u266A`,
    color: `#353c37`,
    title: `I did not expect this to make such a difference`,
    titleKo: `\uC774 \uC791\uC740 \uCC28\uC774\uAC00 \uC774\uB807\uAC8C \uD074 \uC904 \uBAB0\uB790\uC5B4\uC694`,
    views: 428e3,
    orders: 61,
    shape: [3, 16, 47, 42, 19, 10, 5, 4, 3, 2],
    kind: `burst`,
  },
  {
    id: `Instagram`,
    mark: `\u25CE`,
    color: `#b78162`,
    title: `A little upgrade to the everyday`,
    titleKo: `\uC77C\uC0C1\uC744 \uC870\uAE08 \uB354 \uC88B\uAC8C \uB9CC\uB4DC\uB294 \uC544\uC774\uD15C`,
    views: 167200,
    orders: 46,
    shape: [3, 6, 9, 12, 15, 17, 16, 14, 13, 12],
    kind: `steady`,
  },
];

const reasonLabels = {
  comfort: [`Comfort`, `\uD3B8\uC548\uD568`],
  performance: [`Performance`, `\uC131\uB2A5`],
  design: [`Design`, `\uB514\uC790\uC778`],
  price: [`Price`, `\uAC00\uACA9`],
  convenience: [`Convenience`, `\uD3B8\uC758\uC131`],
  durability: [`Durability`, `\uB0B4\uAD6C\uC131`],
};

const productReasons = {
  "sony-wh1000xm5": {
    comfort: 34,
    performance: 28,
    design: 16,
    price: 10,
    convenience: 8,
    durability: 4,
  },
  "airpods-pro-2": {
    comfort: 23,
    performance: 29,
    design: 10,
    price: 8,
    convenience: 24,
    durability: 6,
  },
  kanken: {
    comfort: 13,
    performance: 7,
    design: 36,
    price: 12,
    convenience: 18,
    durability: 14,
  },
};

const defaultReasons = {
  comfort: 12,
  performance: 25,
  design: 24,
  price: 14,
  convenience: 17,
  durability: 8,
};

function getReasons(e2) {
  return new Intl.NumberFormat(`en-US`, {
    style: `currency`,
    currency: `USD`,
    maximumFractionDigits: 0,
  }).format(e2);
}

function formatRevenue(e2) {
  return e2 >= 1e3 ? `${(e2 / 1e3).toFixed(e2 >= 1e5 ? 0 : 1)}k` : String(e2);
}

function campaignTitle(e2, t2) {
  let n2 = t2.reduce((e3, t3) => e3 + t3, 0),
    r2 = t2.map((t3) => Math.floor((e2 * t3) / n2));
  return ((r2[r2.length - 1] += e2 - r2.reduce((e3, t3) => e3 + t3, 0)), r2);
}

export {
  campaigns,
  reasonLabels,
  productReasons,
  defaultReasons,
  getReasons,
  formatRevenue,
  campaignTitle,
};
