import { useState, type CSSProperties } from 'react';

export function NeedleMark({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="10" fill="currentColor" /><path d="M21.5 9.5 14 21.8l-4.2 1 1-4.2L23.1 11c1.2-.8-.4-2.7-1.6-1.5Z" stroke="white" strokeWidth="1.55" strokeLinejoin="round" /><path d="m18.8 13.2 1.9-1.9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

export function formatMoney(price: number | null | undefined, currency: string | null | undefined) {
  if (price == null || !currency) return 'Price unavailable';
  try {
    return `${currency.toUpperCase()} ${new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: ['KRW', 'JPY'].includes(currency.toUpperCase()) ? 0 : 2 }).format(price)}`;
  } catch { return `${currency} ${price.toLocaleString()}`; }
}

export function ProductImage({ src, alt, className = '', style }: { src?: string | null; alt: string; className?: string; style?: CSSProperties }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={`product-image ${className}`} style={style}>{src && src !== failedUrl ? <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(src)} /> : <span className="image-placeholder">Image unavailable</span>}</div>;
}
