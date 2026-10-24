import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Crop, History, ImagePlus, Info, Plus, RefreshCw, Search, Settings2, ShoppingCart, Compass, Bookmark } from 'lucide-react';
import type { CapturedSelection, CartItem, ClarifyRequest, DemoOrder, DiscoverRequest, HealthResponse, RefineRequest, SearchResponse, Selection } from '../../shared/types';
import { clearCapturedSelection, getCapturedSelection, isExtension, requestCapture, subscribeToSelection } from '../extension/client';
import { apiRequest, RequestError } from './api';
import { CropDialog } from './CropDialog';
import { CheckoutDialog, type CheckoutSelection } from './CheckoutDialog';
import { ProductResult } from './ProductResult';
import { SearchProgress } from './SearchProgress';
import { VoiceReply } from './VoiceReply';
import { ShoppingSwitch } from './ShoppingSwitch';
import { Cart, PurchaseHistory } from './SavedItems';
import { NeedleMark, ProductImage } from './ui';
import './styles.css';
import { IntentWorkspace } from './IntentWorkspace';
import { CommerceWorkspace } from './CommerceWorkspace';
import { contextTags } from '../../shared/context';
import './commerce.css';

const examples = [
  { name: 'Headphones', query: 'Sony WH-1000XM5 headphones', image: 'assets/photos/headphones.png' },
  { name: 'Backpack', query: 'Fjallraven Kanken backpack', image: 'assets/photos/bag.png' },
  { name: 'Microphone', query: 'Shure SM7B podcast microphone', image: 'assets/photos/podcast.png' },
];
type Pending = { path: '/discover'; body: DiscoverRequest } | { path: '/refine'; body: RefineRequest } | { path: '/clarify'; body: ClarifyRequest };
type Problem = { message: string; retryable: boolean };
type View = 'intent' | 'saved' | 'find' | 'cart' | 'history';
const currencyCodes = Intl.supportedValuesOf('currency');

export default function App() {
  const [view, setView] = useState<View>('find');
  const [experienceVersion, setExperienceVersion] = useState(0);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [serviceOffline, setServiceOffline] = useState(false);
  const [selection, setSelection] = useState<Selection>({});
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [instruction, setInstruction] = useState('');
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, setPending] = useState<Pending['path'] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captured, setCaptured] = useState<CapturedSelection | null>(null);
  const [checkout, setCheckout] = useState<CheckoutSelection | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [shoppingEnabled, setShoppingEnabled] = useState<boolean | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [collectionError, setCollectionError] = useState('');
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState('');
  const active = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const previousRequest = useRef<Pending | null>(null);
  const lastCaptureId = useRef('');
  const queryRef = useRef<HTMLTextAreaElement>(null);
  const cartMutation = useRef(false);
  const collectionVersion = useRef(0);
  const searchStarted = useRef(0);
  const shoppingEnabledRef = useRef<boolean | null>(null);
  const captureHydrationVersion = useRef(0);
  const captureOrigin = useRef(false);
  const shoppingChanged = useCallback((enabled: boolean) => {
    shoppingEnabledRef.current = enabled;
    if (!enabled) {
      captureHydrationVersion.current++; setCaptured(null);
      if (captureOrigin.current) {
        captureOrigin.current = false;
        active.current?.abort(); active.current = null; requestId.current++; setPending(null);
        setResponse(null); setProblem(null); setSelection({}); setQuery(''); setPreview(null); setInstruction(''); setClarificationAnswer(''); setShowEdit(false); setCheckout(null); setCropImage(null); previousRequest.current = null;
      }
    }
    setShoppingEnabled(enabled);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const status = await apiRequest<HealthResponse>('/health', undefined, AbortSignal.timeout(5000));
      setHealth(status); setServiceOffline(false);
    } catch { setServiceOffline(true); setHealth(null); }
  }, []);
  const refreshCollections = useCallback(async () => {
    if (cartMutation.current) return;
    const version = ++collectionVersion.current;
    setCollectionLoading(true);
    try {
      const [basket, history] = await Promise.all([apiRequest<{ items: CartItem[] }>('/cart', undefined, AbortSignal.timeout(5000)), apiRequest<{ orders: DemoOrder[] }>('/orders', undefined, AbortSignal.timeout(5000))]);
      if (version !== collectionVersion.current) return;
      setCart(basket.items); setOrders(history.orders); setCollectionError('');
    } catch (error) { if (version === collectionVersion.current) setCollectionError(error instanceof Error ? error.message : 'Your saved items could not be loaded.'); }
    finally { if (version === collectionVersion.current) setCollectionLoading(false); }
  }, []);
  useEffect(() => { void refreshHealth(); void refreshCollections(); return () => active.current?.abort(); }, [refreshHealth, refreshCollections]);
  useEffect(() => {
    let alive = true;
    let receivedUpdate = false;
    const hydrationVersion = captureHydrationVersion.current;
    const unsubscribe = subscribeToSelection(value => {
      receivedUpdate = true;
      if (shoppingEnabledRef.current === false) { lastCaptureId.current = value.id; return; }
      setCaptured(value);
    });
    void getCapturedSelection().then(value => {
      if (alive && !receivedUpdate && value && shoppingEnabledRef.current !== false && captureHydrationVersion.current === hydrationVersion) setCaptured(value);
    }).catch(() => undefined);
    return () => { alive = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void refreshCollections(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [refreshCollections]);
  useEffect(() => {
    if (!pending) return;
    setElapsed(0); const timer = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - searchStarted.current) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);

  const stopRequest = useCallback(() => { active.current?.abort(); active.current = null; requestId.current++; setPending(null); }, []);
  const run = useCallback(async (request: Pending) => {
    active.current?.abort(); const id = ++requestId.current; searchStarted.current = Date.now();
    const controller = new AbortController(); active.current = controller; previousRequest.current = request;
    setCheckout(null); setPending(request.path); setProblem(null); setElapsed(0);
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const result = await apiRequest<SearchResponse>(request.path, request.body, controller.signal);
      if (requestId.current !== id) return;
      setResponse(result); setSelectedOfferId(result.offers[0]?.id ?? ''); setServiceOffline(false); setShowEdit(false);
      if (request.path === '/refine') setInstruction('');
      if (request.path === '/clarify') setClarificationAnswer('');
    } catch (error) {
      if (requestId.current !== id) return;
      setProblem({ message: controller.signal.aborted ? 'Search took too long. Try a clearer crop or description.' : error instanceof Error ? error.message : 'Search could not finish. Try again.', retryable: error instanceof RequestError ? error.retryable : true });
      if (request.path !== '/clarify') setShowEdit(true);
    } finally { clearTimeout(timeout); if (requestId.current === id) { setPending(null); active.current = null; } }
  }, []);
  const discover = useCallback((target: Selection, fromCapture = false) => {
    if (fromCapture && shoppingEnabledRef.current !== true) return;
    setCheckout(null); setView('find');
    if (!target.text?.trim() && !target.imageDataUrl && !target.imageUrl) { setProblem({ message: 'Select an object or describe what you want.', retryable: false }); queryRef.current?.focus(); return; }
    const amount = budget.trim() === '' ? undefined : Number(budget);
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) { setProblem({ message: 'Enter a budget greater than zero, or leave it empty.', retryable: false }); return; }
    captureOrigin.current = fromCapture;
    setResponse(null); setSelection(target); setClarificationAnswer(''); setInstruction('');
    void run({ path: '/discover', body: { selection: target, mode: 'sample', preferences: amount === undefined ? undefined : { budget: amount, currency } } });
  }, [budget, currency, run]);

  useEffect(() => {
    if (shoppingEnabledRef.current !== true || shoppingEnabled !== true || !captured || lastCaptureId.current === captured.id || (!health && !captured.result && !captured.error)) return;
    lastCaptureId.current = captured.id;
    captureOrigin.current = true;
    stopRequest(); setCheckout(null); setCropImage(null); setProblem(null); setResponse(null); setView('find'); setClarificationAnswer(''); setInstruction('');
    setSelection(captured.selection); setQuery(captured.selection.text ?? ''); setPreview(captured.selection.imageDataUrl ?? captured.selection.imageUrl ?? null); setShowEdit(false);
    if (captured.error) { setProblem({ message: captured.error, retryable: false }); setShowEdit(true); }
    else if (captured.needsCrop && captured.screenshotDataUrl) setCropImage(captured.screenshotDataUrl);
    else if (captured.result) {
      const result = captured.result;
      const offer = result.offers.find(item => item.id === captured.offerId) ?? result.offers[0];
      setResponse(result); setSelectedOfferId(offer?.id ?? '');
      setShowEdit(false);
      if (!cartMutation.current && offer && (captured.intent === 'buy' || captured.intent === 'cart')) setCheckout({ offer, sessionId: result.sessionId, action: captured.intent, variant: captured.variant, fallbackSrc: captured.selection.imageDataUrl ?? captured.selection.imageUrl });
    } else discover(captured.selection, true);
  }, [captured, health, shoppingEnabled, discover, stopRequest]);

  function reset() {
    captureOrigin.current = false;
    stopRequest(); setResponse(null); setProblem(null); setSelection({}); setQuery(''); setPreview(null); setInstruction(''); setClarificationAnswer(''); setShowEdit(false); setCheckout(null); setView('find'); setCropImage(null); previousRequest.current = null; void clearCapturedSelection();
  }
  async function capture() {
    setCaptureBusy(true); setProblem(null);
    const hydrationVersion = captureHydrationVersion.current;
    try {
      const value = await requestCapture();
      if (shoppingEnabledRef.current === true && captureHydrationVersion.current === hydrationVersion) setCaptured(value);
    }
    catch (error) { if (shoppingEnabledRef.current === true && captureHydrationVersion.current === hydrationVersion) setProblem({ message: error instanceof Error ? error.message : 'Capture failed. Try a description.', retryable: false }); }
    finally { setCaptureBusy(false); }
  }
  function cropApplied(image: string) { setCropImage(null); setPreview(image); setQuery(''); setShowEdit(false); discover({ ...selection, text: undefined, imageDataUrl: image, imageUrl: undefined, annotatedImageDataUrl: undefined, focus: undefined, clarifications: undefined }, captureOrigin.current); }
  async function updateCart(path: string, body: unknown) {
    if (cartMutation.current) return;
    cartMutation.current = true; collectionVersion.current++; setMutating(true); setCollectionLoading(false); setCollectionError('');
    try { const result = await apiRequest<{ items: CartItem[] }>(path, body, AbortSignal.timeout(10000)); setCart(result.items); }
    catch (error) { setCollectionError(error instanceof Error ? error.message : 'The cart could not be updated.'); }
    finally { cartMutation.current = false; setMutating(false); }
  }
  async function saveProduct() {
    if (!selectedOffer || !response || saveBusy) return;
    setSaveBusy(true); setSaveError('');
    try {
      await apiRequest('/saved-items', { sessionId: response?.sessionId, id: `product:${selectedOffer.id}`, label: selectedOffer.title, summary: selectedOffer.description, sourceOrigin: 'https://needle.local', sourceTitle: 'Needle recommendation', tags: contextTags(`${selectedOffer.title} ${selectedOffer.description}`), provenance: 'observed', offer: selectedOffer }, AbortSignal.timeout(8000));
      setExperienceVersion(value => value + 1); setToast('Saved to your wishlist'); setView('saved');
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save this product.'); }
    finally { setSaveBusy(false); }
  }
  function openContextResult(result: SearchResponse) {
    captureOrigin.current = false;
    stopRequest(); setCheckout(null); setCropImage(null); setProblem(null); setSaveError('');
    setResponse(result); setSelectedOfferId(result.offers[0]?.id ?? '');
    setSelection({ text: result.interpretation.name, pageTitle: 'Needle confirmed context' });
    setQuery(result.interpretation.name); setPreview(null); setInstruction(''); setClarificationAnswer('');
    setShowEdit(false); setView('find'); previousRequest.current = null;
  }
  async function clearCollection(collection: 'cart' | 'history') {
    if (cartMutation.current || collectionLoading || !(collection === 'cart' ? cart.length : orders.length)) return;
    cartMutation.current = true; collectionVersion.current++;
    setMutating(true); setCollectionLoading(false); setCollectionError(''); setToast(''); setCheckout(null);
    try {
      if (collection === 'cart') {
        const result = await apiRequest<{ items: CartItem[] }>('/cart/clear', {}, AbortSignal.timeout(10000));
        setCart(result.items); setToast('Cart cleared');
      } else {
        const result = await apiRequest<{ orders: DemoOrder[] }>('/orders/clear', {}, AbortSignal.timeout(10000));
        setOrders(result.orders); setToast('Purchase history cleared');
      }
    } catch (error) {
      setCollectionError(error instanceof Error ? error.message : `Your ${collection === 'cart' ? 'cart' : 'purchase history'} could not be cleared.`);
    } finally { cartMutation.current = false; setMutating(false); }
  }
  function openView(next: View) { setView(next); if (next === 'cart' || next === 'history') void refreshCollections(); }
  function reviewCheckout(value: CheckoutSelection) { if (!cartMutation.current) setCheckout(value); }
  const selectedOffer = response?.offers.find(item => item.id === selectedOfferId) ?? response?.offers[0];
  const hasFind = !!(response || preview || pending || selection.text);
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  return <div className={`needle-app ${isExtension ? 'extension-app' : 'preview-app'}`}>
    <header className="app-header"><button className="wordmark" onClick={reset} aria-label="Needle home"><NeedleMark size={28} /><span>needle</span></button><div className="header-actions"><ShoppingSwitch onChange={shoppingChanged} /><button className="icon-button" onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings} aria-label="Shopping preferences"><Settings2 size={18} /></button></div></header>
    <nav className="app-nav" aria-label="Shopping"><button aria-current={view === 'find' ? 'page' : undefined} onClick={() => openView('find')}><Search size={16} />Find</button><button aria-current={view === 'cart' ? 'page' : undefined} onClick={() => openView('cart')}><ShoppingCart size={16} />Cart{cartCount > 0 && <span className="count">{cartCount}</span>}</button><button aria-current={view === 'history' ? 'page' : undefined} onClick={() => openView('history')}><History size={16} />History</button><button aria-current={view === 'intent' ? 'page' : undefined} onClick={() => openView('intent')}><Compass size={16} />Discover</button><button aria-current={view === 'saved' ? 'page' : undefined} onClick={() => openView('saved')}><Bookmark size={16} />Saved</button></nav>
    {showSettings && <section className="settings-panel" aria-label="Shopping preferences"><div className="budget-fields"><label>Budget<input type="number" min="1" value={budget} placeholder="No limit" onChange={event => setBudget(event.target.value)} /></label><label>Currency<select value={currency} onChange={event => setCurrency(event.target.value)}>{currencyCodes.map(code => <option key={code}>{code}</option>)}</select></label></div></section>}
    <main>
      {serviceOffline && <div className="notice" role="alert"><Info size={16} /><div><p>Start the local service to continue.</p><button className="text-button" onClick={() => { void refreshHealth(); void refreshCollections(); }}>Reconnect</button></div></div>}
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
      {view === 'intent' && <IntentWorkspace key={experienceVersion} onOpenResult={openContextResult} onDiscover={query => { setQuery(query); setPreview(null); discover({ text: query, pageTitle: 'Needle context recommendation' }); }} />}
      {view === 'saved' && <CommerceWorkspace refreshKey={experienceVersion} onChanged={() => setExperienceVersion(value => value + 1)} />}
      {view === 'find' && <>
        {!hasFind && <section className="welcome"><div className="welcome-symbol"><NeedleMark size={42} /></div><h1>Shop what you see.</h1><p>Right-click an image or video. Needle finds the item, ready to buy or save.</p><div className="examples">{examples.map(example => <button key={example.name} onClick={() => { setPreview(example.image); setQuery(example.query); discover({ text: example.query, pageTitle: 'Needle sample catalog' }); }}><img src={example.image} alt="" /><span>{example.name}</span></button>)}</div><span className="examples-caption">Try a find</span></section>}
        {(hasFind || showEdit) && <div className="find-heading"><h1>{pending ? 'Finding your item' : response ? 'Your find' : 'Selected item'}</h1><button className="text-button" onClick={reset}><Plus size={14} />New find</button></div>}
        {hasFind && <div className="inspiration">{preview && <ProductImage src={preview} alt="Your selected object" />}<div><span>Your selection</span><strong>{response?.interpretation.name || query || 'Image selection'}</strong><button className="text-button" onClick={() => setShowEdit(!showEdit)} aria-expanded={showEdit}>{showEdit ? 'Hide description' : 'Edit description'}</button></div>{preview && <button className="icon-button" onClick={() => setCropImage(preview)} aria-label="Crop selection"><Crop size={16} /></button>}</div>}
        {(!hasFind || showEdit) && <form className="discovery-form" onSubmit={event => { event.preventDefault(); discover({ ...selection, text: query.trim(), annotatedImageDataUrl: undefined, focus: undefined, clarifications: undefined }); }}><label htmlFor="object-description">{hasFind ? 'Describe your selection' : 'Or describe an item'}</label><textarea ref={queryRef} id="object-description" rows={2} value={query} maxLength={2000} onChange={event => setQuery(event.target.value)} placeholder="A black podcast microphone…" /><div className="discovery-actions">{isExtension && <button type="button" className="secondary-button" disabled={captureBusy || shoppingEnabled !== true} onClick={() => void capture()}><ImagePlus size={15} />{captureBusy ? 'Capturing…' : 'Capture'}</button>}<button className="primary-button" type="submit" disabled={!!pending}><Search size={15} />Find item</button></div></form>}
        {pending && <SearchProgress image={preview} elapsed={elapsed} refining={pending !== '/discover'} onStop={() => { stopRequest(); setProblem({ message: 'Search stopped.', retryable: true }); }} />}
        {problem && <div className="notice" role="alert"><Info size={16} /><div><p>{problem.message}</p>{problem.retryable && previousRequest.current && <button className="text-button" onClick={() => { if (previousRequest.current) void run(previousRequest.current); }}><RefreshCw size={13} />Try again</button>}</div></div>}
        {response && <section className={`results ${pending ? 'results-pending' : ''}`} aria-label="Product recommendations" aria-busy={!!pending}>
          {response.interpretation.needsClarification && <form className="clarification-form" onSubmit={event => {
            event.preventDefault();
            if (clarificationAnswer.trim() && !pending && !active.current) void run({ path: '/clarify', body: { sessionId: response.sessionId, answer: clarificationAnswer.trim(), selection } });
          }}>
            <p id="clarification-question">{response.interpretation.clarification ?? 'Which item do you mean? Describe its position or appearance.'}</p>
            <label htmlFor="clarification-answer">Your answer</label>
            <VoiceReply key={response.sessionId} sessionId={response.sessionId} disabled={!!pending} answer={clarificationAnswer} onTranscript={setClarificationAnswer}>
              <textarea id="clarification-answer" aria-describedby="clarification-question" rows={2} maxLength={1000} value={clarificationAnswer} onChange={event => setClarificationAnswer(event.target.value)} disabled={!!pending} placeholder="The black instrument on the left…" onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
              }} />
            </VoiceReply>
            <div className="clarification-actions"><span>We'll keep your selected image.</span><button className="primary-button" type="submit" disabled={!clarificationAnswer.trim() || !!pending}>{pending === '/clarify' ? 'Finding…' : 'Send answer'}<ArrowUp size={15} /></button></div>
          </form>}
          {selectedOffer ? <ProductResult response={response} offer={selectedOffer} fallbackSrc={preview} pending={!!pending || mutating} onSelect={id => { setSelectedOfferId(id); setCheckout(null); }} onCheckout={reviewCheckout} /> : !response.interpretation.needsClarification && <div className="empty-state"><Search size={26} /><h2>No close match</h2><p>{response.webSearch?.message ?? 'Try a clearer crop, a brand, or a model name.'}</p><button className="secondary-button" onClick={() => setShowEdit(true)}>Edit description</button></div>}
          {selectedOffer && <button className="secondary-button full-width" disabled={saveBusy || !!pending || mutating} onClick={() => void saveProduct()}><Bookmark size={15} />{saveBusy ? 'Saving…' : 'Save to wishlist / collection'}</button>}
          {saveError && <p className="inline-error" role="alert">{saveError}</p>}
          {response.warnings.length > 0 && <details className="search-notes"><summary>Search notes</summary>{response.warnings.map(warning => <p key={warning}>{warning}</p>)}</details>}
          {!response.interpretation.needsClarification && <form className="refine-form" onSubmit={event => { event.preventDefault(); if (instruction.trim() && !pending) void run({ path: '/refine', body: { sessionId: response.sessionId, instruction: instruction.trim() } }); }}><label htmlFor="refine-input">Refine your find</label><div className="refine-input-wrap"><input id="refine-input" placeholder="Similar, under USD 50…" value={instruction} maxLength={1000} onChange={event => setInstruction(event.target.value)} disabled={!!pending} /><button type="submit" aria-label="Refine recommendations" disabled={!instruction.trim() || !!pending}><ArrowUp size={18} /></button></div></form>}
        </section>}
      </>}
      {(view === 'cart' || view === 'history') && <>
        <div className="find-heading"><h1>{view === 'cart' ? 'Your cart' : 'Purchase history'}</h1><div className="collection-actions"><button className="text-button clear-collection" disabled={mutating || collectionLoading || !(view === 'cart' ? cart.length : orders.length)} onClick={() => void clearCollection(view)}>{view === 'cart' ? 'Clear cart' : 'Clear history'}</button><button className="icon-button" aria-label="Refresh saved items" onClick={() => void refreshCollections()} disabled={collectionLoading || mutating}><RefreshCw size={16} /></button></div></div>
        {collectionError && <div className="notice" role="alert"><Info size={16} /><p>{collectionError}</p></div>}
        {collectionLoading && <p className="loading-note" role="status">Loading saved items…</p>}
        {view === 'cart' && (cart.length > 0 || (!collectionLoading && !collectionError)) && <Cart items={cart} busy={mutating} onUpdate={(path, body) => void updateCart(path, body)} onCheckout={reviewCheckout} onFind={() => setView('find')} />}
        {view === 'history' && (orders.length > 0 || (!collectionLoading && !collectionError)) && <PurchaseHistory orders={orders} />}
      </>}
    </main>

    {cropImage && <CropDialog image={cropImage} onApply={cropApplied} onClose={() => setCropImage(null)} />}
    {checkout && <CheckoutDialog key={`${checkout.sessionId}:${checkout.offer.id}:${checkout.action}:${checkout.cartItemId ?? ''}`} {...checkout} onClose={() => setCheckout(null)} onComplete={order => { void refreshCollections(); if (!order) setToast('Added to cart'); }} />}
  </div>;
}

