/** These are deliberately illustrative records, not scraped retailer listings or current commercial offers. */
export interface SampleProduct {
  id: string;
  title: string;
  brand: string;
  model: string;
  productType: string;
  color: string;
  attributes: string[];
  tags: string[];
  price: number | null;
  currency: string | null;
  variants: string[];
  imageUrl: string;
  referenceUrl?: string;
  priceIsIllustrative?: boolean;
  observedAt?: string;
}

export const sampleCatalog: SampleProduct[] = [
  { id: 'sample-sony-xm5', title: 'Sony WH-1000XM5 headphones', brand: 'Sony', model: 'WH-1000XM5', productType: 'headphones', color: 'Silver', attributes: ['Over-ear', 'Wireless', 'Noise cancelling'], tags: ['headphones', 'headphone', 'headset', 'audio', 'music', 'earphones', '헤드폰', '소니', '노이즈캔슬링'], price: 329000, currency: 'KRW', variants: ['Silver', 'Black'], imageUrl: '/assets/headphones.svg' },
  { id: 'sample-soundcore-q20i', title: 'Soundcore Q20i headphones', brand: 'Soundcore', model: 'Q20i', productType: 'headphones', color: 'Black', attributes: ['Over-ear', 'Wireless', 'Noise cancelling'], tags: ['headphones', 'headphone', 'headset', 'audio', 'music', 'earphones', '헤드폰', 'budget', 'cheaper', 'affordable'], price: 49900, currency: 'KRW', variants: ['Black'], imageUrl: '/assets/headphones.svg' },
  { id: 'sample-jbl-720', title: 'JBL Tune 720BT headphones', brand: 'JBL', model: 'Tune 720BT', productType: 'headphones', color: 'Blue', attributes: ['Over-ear', 'Wireless', 'Foldable'], tags: ['headphones', 'headphone', 'headset', 'audio', 'music', 'earphones', '헤드폰', 'blue'], price: 79.95, currency: 'USD', variants: ['Blue', 'Black'], imageUrl: '/assets/headphones.svg' },
  { id: 'sample-kanken', title: 'Fjallraven Kanken backpack', brand: 'Fjallraven', model: 'Kanken', productType: 'bag', color: 'Ochre', attributes: ['Backpack', 'Top handles', 'Everyday carry'], tags: ['bag', 'bags', 'backpack', 'rucksack', 'tote', '가방', '백팩', 'yellow', 'yellow backpack'], price: 109000, currency: 'KRW', variants: ['Ochre', 'Black', 'Navy'], imageUrl: '/assets/bag.svg' },
  { id: 'sample-herschel', title: 'Herschel Classic backpack', brand: 'Herschel', model: 'Classic', productType: 'bag', color: 'Black', attributes: ['Backpack', 'Front pocket', 'Everyday carry'], tags: ['bag', 'bags', 'backpack', 'rucksack', 'tote', '가방', '백팩', 'budget', 'cheaper', 'affordable'], price: 49000, currency: 'KRW', variants: ['Black', 'Navy'], imageUrl: '/assets/bag.svg' },
  { id: 'sample-baggu', title: 'BAGGU Medium Nylon Crescent Bag', brand: 'BAGGU', model: 'Medium Nylon Crescent', productType: 'bag', color: 'Green', attributes: ['Shoulder bag', 'Adjustable strap', 'Nylon'], tags: ['bag', 'bags', 'backpack', 'shoulder', 'tote', 'crossbody', '가방', 'green'], price: 52, currency: 'USD', variants: ['Green', 'Black'], imageUrl: '/assets/bag.svg' },
  { id: 'sample-tertial', title: 'IKEA TERTIAL desk lamp', brand: 'IKEA', model: 'TERTIAL', productType: 'lamp', color: 'White', attributes: ['Adjustable arm', 'Desk clamp', 'Task lighting'], tags: ['lamp', 'lamps', 'light', 'desk', 'lighting', 'table', '조명', '스탠드', '책상', 'budget', 'cheaper', 'affordable'], price: 19900, currency: 'KRW', variants: ['White', 'Dark grey'], imageUrl: '/assets/lamp.svg' },
  { id: 'sample-xiaomi-lamp', title: 'Xiaomi Mi Smart LED Desk Lamp', brand: 'Xiaomi', model: 'Mi Smart LED Desk Lamp', productType: 'lamp', color: 'White', attributes: ['LED', 'Adjustable brightness', 'Task lighting'], tags: ['lamp', 'lamps', 'light', 'desk', 'lighting', 'table', '조명', '스탠드', '책상', 'smart'], price: 59000, currency: 'KRW', variants: ['White'], imageUrl: '/assets/lamp.svg' },
  { id: 'sample-lexon-mina', title: 'Lexon Mina portable lamp', brand: 'Lexon', model: 'Mina', productType: 'lamp', color: 'Blue', attributes: ['Portable', 'Rechargeable', 'Ambient lighting'], tags: ['lamp', 'lamps', 'light', 'desk', 'lighting', 'table', '조명', '스탠드', 'portable', 'blue'], price: 39, currency: 'USD', variants: ['Blue', 'Pink'], imageUrl: '/assets/lamp.svg' },
  { id: 'sample-shure-sm7b', title: 'Shure SM7B podcast microphone', brand: 'Shure', model: 'SM7B', productType: 'microphone', color: 'Black', attributes: ['Dynamic microphone', 'XLR connection', 'Foam windscreen'], tags: ['microphone', 'mic', 'podcast', 'podcasting', 'broadcast', 'recording', '마이크', '슈어'], price: 549000, currency: 'KRW', variants: ['Black'], imageUrl: '/assets/microphone.svg' },
  { id: 'sample-shure-mv7', title: 'Shure MV7+ USB microphone', brand: 'Shure', model: 'MV7+', productType: 'microphone', color: 'Black', attributes: ['USB-C and XLR', 'Dynamic microphone', 'Touch panel'], tags: ['microphone', 'mic', 'podcast', 'podcasting', 'broadcast', 'recording', '마이크', '슈어', 'usb'], price: 389000, currency: 'KRW', variants: ['Black', 'White'], imageUrl: '/assets/microphone.svg' },
  { id: 'sample-fifine-k688', title: 'FIFINE K688 podcast microphone', brand: 'FIFINE', model: 'K688', productType: 'microphone', color: 'Black', attributes: ['USB and XLR', 'Dynamic microphone', 'Headphone monitoring'], tags: ['microphone', 'mic', 'podcast', 'podcasting', 'broadcast', 'recording', '마이크', 'usb', 'budget', 'affordable'], price: 99000, currency: 'KRW', variants: ['Black'], imageUrl: '/assets/microphone.svg' },
  { id: 'sample-rode-psa1', title: 'RØDE PSA1+ microphone boom arm', brand: 'RØDE', model: 'PSA1+', productType: 'boom arm', color: 'Black', attributes: ['Desk clamp', 'Articulated microphone arm', 'Cable management'], tags: ['arm', 'boom', 'stand', 'microphone arm', 'mic arm', 'podcast', 'clamp', '마이크암'], price: 189000, currency: 'KRW', variants: ['Black'], imageUrl: '/assets/boom-arm.svg' },
  { id: 'sample-elgato-arm', title: 'Elgato Wave Mic Arm LP', brand: 'Elgato', model: 'Wave Mic Arm LP', productType: 'boom arm', color: 'Black', attributes: ['Low profile', 'Desk clamp', 'Cable channels'], tags: ['arm', 'boom', 'stand', 'microphone arm', 'mic arm', 'podcast', 'clamp', '마이크암'], price: 149000, currency: 'KRW', variants: ['Black', 'White'], imageUrl: '/assets/boom-arm.svg' },
  { id: 'sample-maono-ba92', title: 'MAONO BA92 microphone arm', brand: 'MAONO', model: 'BA92', productType: 'boom arm', color: 'Black', attributes: ['Low profile', 'Desk clamp', 'Adjustable joints'], tags: ['arm', 'boom', 'stand', 'microphone arm', 'mic arm', 'podcast', 'clamp', '마이크암', 'budget'], price: 59000, currency: 'KRW', variants: ['Black'], imageUrl: '/assets/boom-arm.svg' },
  { id: 'sample-macbook-air', title: 'Apple MacBook Air 13-inch M4', brand: 'Apple', model: 'MacBook Air M4', productType: 'laptop', color: 'Silver', attributes: ['13-inch display', '16GB memory', '256GB storage'], tags: ['laptop', 'notebook', 'computer', 'macbook', '노트북', '맥북'], price: 1490000, currency: 'KRW', variants: ['Silver · 16GB / 256GB', 'Midnight · 16GB / 256GB'], imageUrl: '/assets/laptop.svg' },
  { id: 'sample-lg-gram', title: 'LG gram 14 laptop', brand: 'LG', model: 'gram 14', productType: 'laptop', color: 'White', attributes: ['14-inch display', '16GB memory', '512GB storage'], tags: ['laptop', 'notebook', 'computer', '노트북', '그램'], price: 1290000, currency: 'KRW', variants: ['White · 16GB / 512GB'], imageUrl: '/assets/laptop.svg' },
  { id: 'sample-asus-vivobook', title: 'ASUS Vivobook 15 laptop', brand: 'ASUS', model: 'Vivobook 15', productType: 'laptop', color: 'Silver', attributes: ['15-inch display', '16GB memory', '512GB storage'], tags: ['laptop', 'notebook', 'computer', '노트북', 'budget', 'affordable'], price: 649000, currency: 'KRW', variants: ['Silver · 16GB / 512GB'], imageUrl: '/assets/laptop.svg' },
];

export const SAMPLE_NOTICE = 'Sample catalog: product descriptions, illustrations, prices, and variants are prepared examples. These are not verified retailer listings, current prices, or live availability.';
