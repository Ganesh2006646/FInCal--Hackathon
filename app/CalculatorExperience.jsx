'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

function extractBodyMarkup(htmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    doc.querySelectorAll('script').forEach(node => node.remove());
    return doc.body.innerHTML;
  } catch {
    return '<main class="native-shell-fallback"><p>Unable to load calculator markup.</p></main>';
  }
}

export default function CalculatorExperience() {
  const [markup, setMarkup] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayEntered, setOverlayEntered] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/legacy/index.html')
      .then(response => response.text())
      .then(htmlText => {
        if (!cancelled) setMarkup(extractBodyMarkup(htmlText));
      })
      .catch(() => {
        if (!cancelled) {
          setMarkup('<main class="native-shell-fallback"><p>Unable to load calculator markup.</p></main>');
        }
      });

    const hasSeenOverlay = window.localStorage.getItem('fincal-onboarding-seen');
    if (!hasSeenOverlay) setShowOverlay(true);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (markup && scriptReady && typeof window !== 'undefined' && typeof window.__fincalInit === 'function') {
      window.__fincalInit();
    }
  }, [markup, scriptReady]);

  useEffect(() => {
    if (!showOverlay) {
      setOverlayEntered(false);
      return;
    }

    const enterTimer = window.setTimeout(() => setOverlayEntered(true), 40);
    return () => window.clearTimeout(enterTimer);
  }, [showOverlay]);

  function closeOverlay(afterClose) {
    setOverlayEntered(false);
    window.localStorage.setItem('fincal-onboarding-seen', '1');
    window.setTimeout(() => {
      setShowOverlay(false);
      afterClose?.();
    }, 220);
  }

  function startPlanning() {
    closeOverlay(() => {
      window.goToStep?.(1);
    });
  }

  function runDemo() {
    closeOverlay(() => {
      window.goToStep?.(4);
      window.setTimeout(() => window.runJudgeDemo?.(true), 900);
    });
  }

  function dismiss() {
    closeOverlay();
  }

  return (
    <>
      <main className="native-shell-root">
        <div className="native-shell-frame" dangerouslySetInnerHTML={{ __html: markup }} />
      </main>

      {showOverlay ? (
        <div className={`judge-onboarding${overlayEntered ? ' visible' : ''}`} role="dialog" aria-modal="true" aria-labelledby="judge-overlay-heading">
          <div className="judge-onboarding-card">
            <span className="judge-onboarding-eyebrow">Judge Demo Guide</span>
            <h2 id="judge-overlay-heading">Start with a polished walkthrough</h2>
            <p>
              This experience is designed to show why your retirement plan changes when healthcare costs,
              city choice, inflation, and income growth are treated realistically.
            </p>
            <div className="judge-onboarding-points">
              <div className="judge-point">
                <strong>1. Smart assumptions</strong>
                <span>Every key planning input is editable and clearly disclosed.</span>
              </div>
              <div className="judge-point">
                <strong>2. Decision lab</strong>
                <span>Stress tests, snapshots, and quick chips make the tool feel alive.</span>
              </div>
              <div className="judge-point">
                <strong>3. Storytelling</strong>
                <span>Milestones, deltas, and the guided demo explain the impact instantly.</span>
              </div>
            </div>
            <div className="judge-onboarding-actions">
              <button className="btn-primary" onClick={startPlanning}>Start Planning</button>
              <button className="btn-secondary" onClick={runDemo}>Run Judge Demo</button>
              <button className="btn-secondary-light" onClick={dismiss}>Dismiss</button>
            </div>
          </div>
        </div>
      ) : null}

      {markup ? (
        <Script
          src="/legacy/app.js"
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
        />
      ) : null}
    </>
  );
}
