import { useEffect, useId, useRef, useState } from "react";
import "./ExtensionDemo.css";

const stages = [
  { name: "spot", duration: 2000 },
  { name: "point", duration: 1500 },
  { name: "search", duration: 2600 },
  { name: "match", duration: 2600 },
  { name: "add", duration: 1000 },
  { name: "done", duration: 0 },
];

const captions = {
  en: [
    "Spot something you like.",
    "Right-click the item.",
    "Needle searches for a match.",
    "Your match, ready to shop.",
    "One click to add it.",
    "Found it. Added to your cart.",
  ],
  ko: [
    "마음에 드는 상품을 발견하세요.",
    "상품을 마우스 오른쪽으로 클릭하세요.",
    "Needle이 비슷한 상품을 찾아요.",
    "찾은 상품을 바로 확인하세요.",
    "클릭 한 번으로 장바구니에.",
    "찾았어요. 장바구니에 담았어요.",
  ],
};

function PlaybackIcon({ mode }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {mode === "replay" ? (
        <path d="M3 5a5.25 5.25 0 1 1-.3 5M3 2v3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : mode === "resume" ? (
        <path d="m5 3 7 5-7 5Z" fill="currentColor" />
      ) : (
        <path d="M5.5 3.5v9m5-9v9" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** An illustration of the extension. Its shopping controls never mutate real data. */
export function ExtensionDemo({ lang = "en", paused: externallyPaused = false }) {
  const rootRef = useRef(null);
  const titleId = useId();
  const [stageIndex, setStageIndex] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [replayCount, setReplayCount] = useState(0);
  const remaining = useRef({ stage: -1, milliseconds: 0 });
  const translate = (english, korean) => (lang === "ko" ? korean : english);
  const displayIndex = reducedMotion ? stages.length - 1 : stageIndex;
  const stage = stages[displayIndex].name;
  const finished = displayIndex === stages.length - 1;
  const running = visible && pageVisible && !externallyPaused && !manuallyPaused && !reducedMotion && !finished;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changeMotion = () => setReducedMotion(preference.matches);
    const changeVisibility = () => setPageVisible(!document.hidden);
    preference.addEventListener("change", changeMotion);
    document.addEventListener("visibilitychange", changeVisibility);

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.35),
      { threshold: [0, 0.35] },
    );
    if (rootRef.current) observer.observe(rootRef.current);

    return () => {
      observer.disconnect();
      preference.removeEventListener("change", changeMotion);
      document.removeEventListener("visibilitychange", changeVisibility);
    };
  }, []);

  useEffect(() => {
    if (remaining.current.stage !== stageIndex) {
      remaining.current = { stage: stageIndex, milliseconds: stages[stageIndex].duration };
    }
    if (!running) return;

    const clock = remaining.current;
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      clock.milliseconds = 0;
      setStageIndex((current) => Math.min(current + 1, stages.length - 1));
    }, clock.milliseconds);

    return () => {
      window.clearTimeout(timer);
      clock.milliseconds = Math.max(0, clock.milliseconds - (performance.now() - startedAt));
    };
  }, [stageIndex, running, replayCount]);

  function controlPlayback() {
    if (finished) {
      remaining.current = { stage: -1, milliseconds: 0 };
      setStageIndex(0);
      setManuallyPaused(false);
      setReplayCount((current) => current + 1);
    } else {
      setManuallyPaused((current) => !current);
    }
  }

  const control = finished ? "replay" : manuallyPaused ? "resume" : "pause";
  const controlLabel = finished
    ? translate("Replay", "다시 보기")
    : manuallyPaused
      ? translate("Resume", "계속")
      : translate("Pause", "일시정지");

  return (
    <section
      ref={rootRef}
      className="extension-demo"
      data-tour="extension-demo"
      data-stage={stage}
      data-phase={stage}
      data-running={running}
      data-reduced-motion={reducedMotion}
      aria-labelledby={titleId}
    >
      <div className="extension-demo-heading">
        <h2 id={titleId}>{translate("See Needle in action", "Needle 사용 모습")}</h2>
        {!reducedMotion && (
          <button
            type="button"
            className="extension-demo-control"
            onClick={controlPlayback}
            aria-label={translate(`${controlLabel} extension example`, `사용 예시 ${controlLabel}`)}
          >
            <PlaybackIcon mode={control} />
            <span>{controlLabel}</span>
          </button>
        )}
      </div>

      <div className="extension-demo-scene" key={replayCount} aria-hidden="true">
        <div className="extension-demo-browser-bar">
          <span className="extension-demo-browser-dots"><i /><i /><i /></span>
          <span>{translate("The everyday edit", "일상을 위한 아이템")}</span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 2.5h6v7l-3-2-3 2Z" stroke="currentColor" strokeWidth="1.1" /></svg>
        </div>
        <div className="extension-demo-article">
          <div className="extension-demo-photo">
            <img src="./assets/products/sony-wh1000xm5.jpg" alt="" draggable="false" />
          </div>
          <div className="extension-demo-article-copy">
            <strong>{translate("A quieter kind of day.", "조금 더 조용한 하루.")}</strong>
            <span /><span /><span />
          </div>
        </div>
        <span className="extension-demo-target" />

        <div className="extension-demo-popup">
          <div className="extension-demo-actions">
            <span className="extension-demo-buy">{translate("Buy", "구매")}</span>
            <span className="extension-demo-add">{translate("Add to cart", "장바구니")}</span>
            <span className="extension-demo-close">
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            </span>
          </div>
          <div className="extension-demo-search">
            <span className="extension-demo-search-ring" />
            <span>{translate("Finding your match…", "상품을 찾는 중…")}</span>
          </div>
          <div className="extension-demo-match">
            <img src="./assets/products/sony-wh1000xm5.jpg" alt="" draggable="false" />
            <div><strong>Sony WH-1000XM5</strong><b>USD $299</b></div>
          </div>
          <div className="extension-demo-success">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="#e4f5ed" /><path d="m6 10 2.5 2.5 5-5" stroke="#18764d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{translate("Added to cart", "장바구니에 담았어요")}</span>
          </div>
        </div>

        <div className="extension-demo-cursor">
          <svg width="19" height="25" viewBox="0 0 19 25" fill="none"><path d="m2 1 15 13-7 .8-3.6 7.7Z" fill="#202730" stroke="white" strokeWidth="1.7" strokeLinejoin="round" /></svg>
        </div>
      </div>

      <p className="extension-demo-caption">{captions[lang === "ko" ? "ko" : "en"][displayIndex]}</p>
      <div className="extension-demo-footer">
        <span>{translate("Example · No payment", "사용 예시 · 결제 없음")}</span>
        <span className="extension-demo-steps" aria-hidden="true">
          {[0, 1, 2].map((step) => <i key={step} data-active={displayIndex >= [0, 2, 5][step]} />)}
        </span>
      </div>
      <p className="extension-demo-description">
        {translate(
          "Right-click an item on a webpage. Needle finds a matching product and shows Buy, Add to cart, and Cancel. This example finds Sony WH-1000XM5 headphones at USD 299 and adds them to an example cart. No payment is taken.",
          "웹페이지에서 상품을 마우스 오른쪽으로 클릭하세요. Needle이 비슷한 상품을 찾아 구매, 장바구니, 취소를 보여 줍니다. 이 예시는 Sony WH-1000XM5 헤드폰을 USD 299에 찾아 예시 장바구니에 담습니다. 결제는 이루어지지 않습니다.",
        )}
      </p>
    </section>
  );
}
