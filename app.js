// ===== Life-Proof Retirement Calculator =====
// Core application logic with dual-track inflation, step-up SIP,
// geo-arbitrage, and 3-scenario modeling.

(function () {
  'use strict';

  let audioCtx = null;
  let journeyTimer = null;
  let narrativeTimer = null;
  let narrativeSequence = 0;
  let initialized = false;

  // ===== STATE =====
  const state = {
    currentAge: 28,
    retirementAge: 60,
    monthlyExpenses: 50000,
    healthcareRatio: 0.25,
    medicalInflation: 0.14,
    lifestyleInflation: 0.06,
    geoModifier: 0.75,       // 1.0 Metro, 0.75 Tier2, 0.50 Tier3
    stepUpEnabled: true,
    annualRaise: 0.10,
    sipCeiling: 0.40,         // % of salary
    postRetirementReturn: 0.07,
    retirementDuration: 25,
    conservativeReturn: 0.06,
    baselineReturn: 0.12,
    optimisticReturn: 0.15,
    // What-If overrides
    whatIfSIP: null,
    whatIfRetireAge: null,
    whatIfPostRetirementReturn: null,
    whatIfRetirementDuration: null,
    stressReference: {
      retireAge: null,
      conservativeReturnPct: null,
      baselineReturnPct: null,
      optimisticReturnPct: null,
    },
    planSnapshots: { A: null, B: null },
    demoTimers: [],
  };

  function updateStressReferenceFromUI() {
    const retireAge = parseInt(document.getElementById('whatif-retire-age')?.value || state.retirementAge);
    const conservativeReturnPct = parseFloat(document.getElementById('whatif-conservative-return')?.value || (state.conservativeReturn * 100));
    const baselineReturnPct = parseFloat(document.getElementById('whatif-baseline-return')?.value || (state.baselineReturn * 100));
    const optimisticReturnPct = parseFloat(document.getElementById('whatif-optimistic-return')?.value || (state.optimisticReturn * 100));

    state.stressReference = {
      retireAge,
      conservativeReturnPct,
      baselineReturnPct,
      optimisticReturnPct,
    };
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function announceStatus(message) {
    const statusEl = document.getElementById('form-status');
    if (statusEl) statusEl.textContent = message;
  }

  function getWhatIfSnapshot() {
    return {
      sip: parseInt(document.getElementById('whatif-sip')?.value || 0),
      retireAge: parseInt(document.getElementById('whatif-retire-age')?.value || state.retirementAge),
      postReturn: parseFloat(document.getElementById('whatif-post-return')?.value || state.postRetirementReturn * 100),
      retirementYears: parseInt(document.getElementById('whatif-retirement-years')?.value || state.retirementDuration),
      baselineReturn: parseFloat(document.getElementById('whatif-baseline-return')?.value || state.baselineReturn * 100),
      lifestyleInflation: parseFloat(document.getElementById('whatif-lifestyle-inflation')?.value || state.lifestyleInflation * 100),
      geoModifier: state.geoModifier,
      medicalInflation: state.medicalInflation * 100,
    };
  }

  function setRangeValue(id, value, formatter) {
    const el = document.getElementById(id);
    if (!el) return;
    const bounded = Math.min(parseFloat(el.max), Math.max(parseFloat(el.min), value));
    el.value = bounded;
    if (formatter) formatter(bounded);
    updateSliderTrack(el);
  }

  function applyLocationModifier(modifier) {
    const match = Array.from(document.querySelectorAll('.location-card')).find(card => parseFloat(card.getAttribute('data-value')) === modifier);
    if (match) selectLocation(match, modifier);
  }

  function setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(inputId.replace('current-age', 'age').replace('retirement-age', 'retire').replace('monthly-expenses', 'expense') + '-error');
    if (input) {
      input.classList.add('error');
      input.setAttribute('aria-invalid', 'true');
    }
    if (error) error.textContent = message;
  }

  function clearFieldError(inputId) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(inputId.replace('current-age', 'age').replace('retirement-age', 'retire').replace('monthly-expenses', 'expense') + '-error');
    if (input) {
      input.classList.remove('error');
      input.setAttribute('aria-invalid', 'false');
    }
    if (error) error.textContent = '';
  }

  // ===== NAVIGATION =====
  window.goToStep = function (stepNum) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const id = stepNum === 0 ? 'step-landing' : 'step-' + stepNum;
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      // Focus the heading for screen readers
      const heading = el.querySelector('h1, h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }
    if (stepNum === 1) syncStep1UI();
    if (stepNum === 3) updateComparisonCards();
  };

  // ===== STEP 1 =====
  function syncStep1UI() {
    syncExpenseSlider();
    updateInflationPreview();
  }

  function syncExpenseSlider() {
    const slider = document.getElementById('expenses-slider');
    const input = document.getElementById('monthly-expenses');
    if (slider && input) {
      slider.value = input.value;
      updateSliderTrack(slider);
    }
  }

  function updateSliderTrack(slider) {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background = `linear-gradient(to right, var(--primary) ${pct}%, var(--grey-light) ${pct}%)`;
  }

  function updateInflationPreview() {
    const expenses = parseInt(document.getElementById('monthly-expenses').value) || 50000;
    const years = (parseInt(document.getElementById('retirement-age').value) || 60) - (parseInt(document.getElementById('current-age').value) || 28);
    if (years <= 0) return;
    const inflated = expenses * Math.pow(1 + state.lifestyleInflation, years);
    document.getElementById('inflated-amount').textContent = formatCurrency(Math.round(inflated));
    document.getElementById('inflation-years').textContent = years;
  }

  function dismissPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    preloader.style.opacity = '0';
    preloader.style.visibility = 'hidden';
    setTimeout(function () {
      if (preloader.parentNode) preloader.remove();
    }, 600);
  }

  function initApp() {
    if (initialized) return;
    initialized = true;

    const ageInput = document.getElementById('current-age');
    const retireInput = document.getElementById('retirement-age');
    const expenseInput = document.getElementById('monthly-expenses');
    const expenseSlider = document.getElementById('expenses-slider');

    if (ageInput) ageInput.addEventListener('input', function () {
      state.currentAge = parseInt(this.value) || 28;
      updateInflationPreview();
    });
    if (retireInput) retireInput.addEventListener('input', function () {
      state.retirementAge = parseInt(this.value) || 60;
      updateInflationPreview();
    });
    if (expenseInput) expenseInput.addEventListener('input', function () {
      state.monthlyExpenses = parseInt(this.value) || 50000;
      if (expenseSlider) { expenseSlider.value = this.value; updateSliderTrack(expenseSlider); }
      updateInflationPreview();
    });
    if (expenseSlider) expenseSlider.addEventListener('input', function () {
      if (expenseInput) expenseInput.value = this.value;
      state.monthlyExpenses = parseInt(this.value);
      updateSliderTrack(this);
      updateInflationPreview();
    });

    // Init slider styles for all range inputs
    document.querySelectorAll('input[type="range"]').forEach(s => updateSliderTrack(s));
    document.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.addEventListener('input', playTick);
    });
    syncStep1UI();
    updateGeoVisual();

    // --- Preloader ---
    window.addEventListener('load', dismissPreloader);
    // When embedded markup is injected after load, dismiss immediately.
    setTimeout(dismissPreloader, 60);

    // --- Power-User Keyboard Shortcuts ---
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        calculateAndShowResults();
      }
      if (['1', '2', '3', '4'].includes(e.key) && !e.metaKey && !e.ctrlKey) {
        goToStep(parseInt(e.key));
      }
    });
  }

  window.__fincalInit = initApp;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  // ===== VALIDATION =====
  window.validateAndGoStep2 = function () {
    const age = parseInt(document.getElementById('current-age').value);
    const retire = parseInt(document.getElementById('retirement-age').value);
    const expenses = parseInt(document.getElementById('monthly-expenses').value);

    clearFieldError('current-age');
    clearFieldError('retirement-age');
    clearFieldError('monthly-expenses');

    if (!age || age < 18 || age > 65) {
      setFieldError('current-age', 'Enter an age between 18 and 65 years.');
      document.getElementById('current-age').focus();
      announceStatus('Current age is invalid. Enter an age between 18 and 65 years.');
      showToast('error', 'Invalid Age', 'Current age must be between 18 and 65 years.', 'Fix Ages');
      return;
    }

    if (!retire || retire <= age) {
      setFieldError('retirement-age', 'Retirement age must be greater than current age.');
      document.getElementById('retirement-age').focus();
      announceStatus('Retirement age is invalid. It must be greater than your current age.');
      showToast('error', 'Time Flows Forward', 'Your retirement age needs to be after your current age. Most people retire between 58–65 in India.', 'Fix Ages');
      return;
    }

    if (!expenses || expenses < 10000 || expenses > 200000) {
      setFieldError('monthly-expenses', 'Enter monthly expenses between 10,000 and 2,00,000 rupees.');
      document.getElementById('monthly-expenses').focus();
      announceStatus('Monthly expenses are invalid. Enter a value between 10,000 and 2,00,000 rupees.');
      showToast('warning', "Let's Be Realistic", 'Monthly expenses should be between ₹10,000 and ₹2,00,000 for this calculator.', 'Adjust');
      return;
    }

    announceStatus('Step 1 completed. Moving to healthcare and retirement assumptions.');

    state.currentAge = age;
    state.retirementAge = retire;
    state.monthlyExpenses = expenses;
    goToStep(2);
  };

  // ===== STEP 2 =====
  window.selectRatio = function (el, value) {
    document.querySelectorAll('.ratio-card').forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-checked', 'false');
    });
    el.classList.add('selected');
    el.setAttribute('aria-checked', 'true');
    state.healthcareRatio = value / 100;
  };

  window.updateMedicalInflation = function (val) {
    state.medicalInflation = parseInt(val) / 100;
    document.getElementById('medical-inflation-display').textContent = val + '%';
    const slider = document.getElementById('medical-inflation');
    updateSliderTrack(slider);
  };

  window.updateLifestyleInflation = function (val) {
    state.lifestyleInflation = parseFloat(val) / 100;
    document.getElementById('lifestyle-inflation-display').textContent = parseFloat(val).toFixed(1).replace('.0', '') + '%';
    const slider = document.getElementById('lifestyle-inflation');
    updateSliderTrack(slider);
  };

  window.selectLocation = function (el, value) {
    document.querySelectorAll('.location-card').forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-checked', 'false');
    });
    el.classList.add('selected');
    el.setAttribute('aria-checked', 'true');
    state.geoModifier = value;
    updateGeoImpact();
    updateGeoVisual();
  };

  function updateGeoImpact() {
    const txt = document.getElementById('geo-impact-text');
    if (state.geoModifier === 1.0) {
      txt.textContent = 'Metro living costs the full amount — no reduction in required corpus';
    } else if (state.geoModifier === 0.75) {
      txt.textContent = 'Choosing Tier-2 reduces your required corpus by ~₹3.5 Lakhs';
    } else {
      txt.textContent = 'Choosing Hometown/Countryside reduces your required corpus by ~₹7 Lakhs';
    }
  }

  function updateGeoVisual() {
    const visual = document.getElementById('geo-visual');
    if (!visual) return;
    if (state.geoModifier === 1.0) visual.setAttribute('data-mode', 'metro');
    else if (state.geoModifier === 0.75) visual.setAttribute('data-mode', 'tier2');
    else visual.setAttribute('data-mode', 'rural');
  }

  function playTick() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.04);
    gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  }

  // ===== STEP 3 =====
  window.toggleStepUp = function (checked) {
    state.stepUpEnabled = checked;
    const inputs = document.getElementById('stepup-inputs');
    if (checked) {
      inputs.classList.add('show');
    } else {
      inputs.classList.remove('show');
    }
    updateComparisonCards();
  };

  window.updateRaise = function (val) {
    state.annualRaise = parseInt(val) / 100;
    document.getElementById('raise-display').textContent = val + '%';
    document.querySelectorAll('.raise-badge').forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-val')) === parseInt(val));
    });
    updateSliderTrack(document.getElementById('annual-raise'));
    updateComparisonCards();
  };

  window.updateCeiling = function (val) {
    state.sipCeiling = parseInt(val) / 100;
    document.getElementById('ceiling-display').textContent = val + '% of salary';
    updateSliderTrack(document.getElementById('sip-ceiling'));
    const warn = document.getElementById('ceiling-warning');
    if (parseInt(val) > 45) warn.classList.remove('hidden');
    else warn.classList.add('hidden');
    updateComparisonCards();
  };

  function updateComparisonCards() {
    const years = state.retirementAge - state.currentAge;
    if (years <= 0) return;

    // Baseline corpus needed
    const annualExpense = state.monthlyExpenses * 12;
    const futureExpense = calcFutureExpense(annualExpense, state.healthcareRatio, state.lifestyleInflation, state.medicalInflation, years);
    const geoAdjusted = futureExpense * state.geoModifier;
    const corpus = calcCorpus(geoAdjusted, state.postRetirementReturn, state.retirementDuration);

    // Traditional (flat) SIP
    const tradSIP = calcFlatSIP(corpus, state.baselineReturn, years);
    // Step-Up SIP
    const stepSIP = state.stepUpEnabled ? calcStepUpSIP(corpus, state.baselineReturn, years, state.annualRaise, state.sipCeiling) : tradSIP;

    // Update comparison UI
    document.getElementById('trad-sip').innerHTML = formatCurrency(Math.round(tradSIP)) + '<span>/mo</span>';
    document.getElementById('lifeproof-sip').innerHTML = formatCurrency(Math.round(stepSIP)) + '<span>/mo</span>';
    document.getElementById('compare-raise').textContent = Math.round(state.annualRaise * 100);

    // Timeline projections
    if (state.stepUpEnabled) {
      const timeline = document.getElementById('compare-timeline');
      let sip = stepSIP;
      const maxCap = tradSIP * (state.sipCeiling / 0.40) * 1.2; // rough ceiling
      const projections = [];
      for (let y = 1; y <= years; y++) {
        if (y === 5 || y === 10 || y === 15) {
          projections.push('Year ' + y + ': ' + formatCurrency(Math.round(sip)));
        }
        sip = Math.min(sip * (1 + state.annualRaise), maxCap);
      }
      timeline.innerHTML = projections.map(p => '<div>' + p + '</div>').join('');
    }
  }

  // ===== STEP 4: CALCULATE & DISPLAY =====
  window.calculateAndShowResults = function () {
    showToast('success', 'Scenarios Calculated!', 'Your personalized retirement plan is ready. Review your three scenarios below.');
    updateStressReferenceFromUI(); // Stabilize baseline before first dashboard view
    runFullCalculation();
    goToStep(4);
    setTimeout(animateCountUp, 200);
    setTimeout(drawChart, 400);
  };

  window.onWhatIfChange = function (sourceElement) {
    const trigger = sourceElement === 'stress' ? 'stress' : (sourceElement ? 'manual' : 'init');
    const previousSnapshot = getWhatIfSnapshot();

    // Read all slider values
    const sipVal = parseInt(document.getElementById('whatif-sip').value);
    const retireVal = parseInt(document.getElementById('whatif-retire-age').value);
    const postReturnVal = parseFloat(document.getElementById('whatif-post-return').value);
    const retirementYearsVal = parseInt(document.getElementById('whatif-retirement-years').value);
    const conservativeReturnVal = parseFloat(document.getElementById('whatif-conservative-return').value);
    const baselineReturnVal = parseFloat(document.getElementById('whatif-baseline-return').value);
    const optimisticReturnVal = parseFloat(document.getElementById('whatif-optimistic-return').value);
    const lifestyleInflationVal = parseFloat(document.getElementById('whatif-lifestyle-inflation').value);

    // Sync labels
    document.getElementById('whatif-sip-display').textContent = formatCurrency(sipVal);
    document.getElementById('whatif-retire-display').textContent = retireVal;
    document.getElementById('whatif-post-return-display').textContent = postReturnVal.toFixed(1) + '%';
    document.getElementById('whatif-retirement-years-display').textContent = retirementYearsVal;
    document.getElementById('whatif-conservative-return-display').textContent = conservativeReturnVal.toFixed(1) + '%';
    document.getElementById('whatif-baseline-return-display').textContent = baselineReturnVal.toFixed(1) + '%';
    document.getElementById('whatif-optimistic-return-display').textContent = optimisticReturnVal.toFixed(1) + '%';
    document.getElementById('whatif-lifestyle-inflation-display').textContent = lifestyleInflationVal.toFixed(1) + '%';

    // Update tracks
    document.querySelectorAll('.whatif-panel input[type="range"]').forEach(updateSliderTrack);

    // CRITICAL: Only "lock" the SIP value if the user specifically touched the SIP slider.
    // Otherwise, let the calculator continue "solving" for the required SIP as other sliders move.
    if (sourceElement && sourceElement.id === 'whatif-sip') {
      state.whatIfSIP = sipVal;
    }

    state.whatIfRetireAge = retireVal;
    state.whatIfPostRetirementReturn = postReturnVal / 100;
    state.whatIfRetirementDuration = retirementYearsVal;
    state.conservativeReturn = conservativeReturnVal / 100;
    state.baselineReturn = baselineReturnVal / 100;
    state.optimisticReturn = optimisticReturnVal / 100;
    state.lifestyleInflation = lifestyleInflationVal / 100;

    if (trigger !== 'stress') {
      updateStressReferenceFromUI();
    }

    runFullCalculation();
    drawChart();
    updateEverydayTranslator();
    updateDeltaSummary(previousSnapshot, getWhatIfSnapshot());
  };

  window.applyQuickAdjustment = function (type) {
    const previousSnapshot = getWhatIfSnapshot();
    if (type === 'sip-plus') {
      setRangeValue('whatif-sip', (parseInt(document.getElementById('whatif-sip').value) || 0) + 1000);
    } else if (type === 'retire-later') {
      setRangeValue('whatif-retire-age', (parseInt(document.getElementById('whatif-retire-age').value) || state.retirementAge) + 3);
    } else if (type === 'tier2') {
      applyLocationModifier(0.75);
    } else if (type === 'return-down') {
      setRangeValue('whatif-baseline-return', (parseFloat(document.getElementById('whatif-baseline-return').value) || 0) - 1);
    } else if (type === 'medical-up') {
      updateMedicalInflation(16);
      const medSlider = document.getElementById('medical-inflation');
      if (medSlider) { medSlider.value = 16; updateSliderTrack(medSlider); }
    } else if (type === 'reset') {
      setRangeValue('whatif-retire-age', state.retirementAge);
      setRangeValue('whatif-post-return', state.postRetirementReturn * 100);
      setRangeValue('whatif-retirement-years', state.retirementDuration);
      setRangeValue('whatif-conservative-return', 6);
      setRangeValue('whatif-baseline-return', 12);
      setRangeValue('whatif-optimistic-return', 15);
      setRangeValue('whatif-lifestyle-inflation', 6);
      updateMedicalInflation(14);
      const medSlider = document.getElementById('medical-inflation');
      if (medSlider) { medSlider.value = 14; updateSliderTrack(medSlider); }
      applyLocationModifier(0.75);
    }
    onWhatIfChange();
    updateDeltaSummary(previousSnapshot, getWhatIfSnapshot());
  };

  function runFullCalculation() {
    const years = (state.whatIfRetireAge || state.retirementAge) - state.currentAge;
    if (years <= 0) return;

    const annualExpense = state.monthlyExpenses * 12;
    const futureExpense = calcFutureExpense(annualExpense, state.healthcareRatio, state.lifestyleInflation, state.medicalInflation, years);
    const geoAdjusted = futureExpense * state.geoModifier;
    const postReturnRate = state.whatIfPostRetirementReturn || state.postRetirementReturn;
    const retirementDuration = state.whatIfRetirementDuration || state.retirementDuration;
    const targetCorpus = calcCorpus(geoAdjusted, postReturnRate, retirementDuration);

    const scenarios = [
      { rate: state.conservativeReturn, id: 'conservative', label: 'Conservative' },
      { rate: state.baselineReturn, id: 'baseline', label: 'Baseline' },
      { rate: state.optimisticReturn, id: 'optimistic', label: 'Optimistic' },
    ];

    // Determine starting SIP
    let startingSIP;
    if (state.whatIfSIP) {
      startingSIP = state.whatIfSIP;
    } else if (state.stepUpEnabled) {
      startingSIP = calcStepUpSIP(targetCorpus, state.baselineReturn, years, state.annualRaise, state.sipCeiling);
    } else {
      startingSIP = calcFlatSIP(targetCorpus, state.baselineReturn, years);
    }

    // What-If sliders sync
    const whatIfSlider = document.getElementById('whatif-sip');
    if (whatIfSlider && !state.whatIfSIP) {
      whatIfSlider.value = Math.round(startingSIP);
      document.getElementById('whatif-sip-display').textContent = formatCurrency(Math.round(startingSIP));
      updateSliderTrack(whatIfSlider);
    }
    const retireSlider = document.getElementById('whatif-retire-age');
    if (retireSlider && !state.whatIfRetireAge) {
      retireSlider.value = state.retirementAge;
      document.getElementById('whatif-retire-display').textContent = state.retirementAge;
      updateSliderTrack(retireSlider);
    }
    const postReturnSlider = document.getElementById('whatif-post-return');
    if (postReturnSlider && !state.whatIfPostRetirementReturn) {
      postReturnSlider.value = state.postRetirementReturn * 100;
      document.getElementById('whatif-post-return-display').textContent = (state.postRetirementReturn * 100).toFixed(1) + '%';
      updateSliderTrack(postReturnSlider);
    }
    const retirementYearsSlider = document.getElementById('whatif-retirement-years');
    if (retirementYearsSlider && !state.whatIfRetirementDuration) {
      retirementYearsSlider.value = state.retirementDuration;
      document.getElementById('whatif-retirement-years-display').textContent = state.retirementDuration;
      updateSliderTrack(retirementYearsSlider);
    }
    const conservativeReturnSlider = document.getElementById('whatif-conservative-return');
    if (conservativeReturnSlider) {
      conservativeReturnSlider.value = state.conservativeReturn * 100;
      document.getElementById('whatif-conservative-return-display').textContent = (state.conservativeReturn * 100).toFixed(1) + '%';
      updateSliderTrack(conservativeReturnSlider);
    }
    const baselineReturnSlider = document.getElementById('whatif-baseline-return');
    if (baselineReturnSlider) {
      baselineReturnSlider.value = state.baselineReturn * 100;
      document.getElementById('whatif-baseline-return-display').textContent = (state.baselineReturn * 100).toFixed(1) + '%';
      updateSliderTrack(baselineReturnSlider);
    }
    const optimisticReturnSlider = document.getElementById('whatif-optimistic-return');
    if (optimisticReturnSlider) {
      optimisticReturnSlider.value = state.optimisticReturn * 100;
      document.getElementById('whatif-optimistic-return-display').textContent = (state.optimisticReturn * 100).toFixed(1) + '%';
      updateSliderTrack(optimisticReturnSlider);
    }
    const lifestyleInflationSlider = document.getElementById('whatif-lifestyle-inflation');
    if (lifestyleInflationSlider) {
      lifestyleInflationSlider.value = state.lifestyleInflation * 100;
      document.getElementById('whatif-lifestyle-inflation-display').textContent = (state.lifestyleInflation * 100).toFixed(1) + '%';
      updateSliderTrack(lifestyleInflationSlider);
    }

    // Summary
    document.getElementById('result-starting-sip').textContent = formatCurrency(Math.round(startingSIP)) + '/month';
    if (state.stepUpEnabled) {
      const capYear = Math.min(years, Math.ceil(Math.log(targetCorpus * 0.001 / startingSIP) / Math.log(1 + state.annualRaise)));
      const cappedSIP = startingSIP * Math.pow(1 + state.annualRaise, Math.min(15, years));
      document.getElementById('result-growth-note').innerHTML =
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="#2e7d32" stroke-width="1.5" fill="#e8f5e9"/><path d="M7 10l2 2 4-4" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        'Growing ' + Math.round(state.annualRaise * 100) + '% annually until capped at ' + formatCurrency(Math.round(cappedSIP)) + ' in Year ' + Math.min(15, years);
    } else {
      document.getElementById('result-growth-note').textContent = 'Flat SIP — no annual step-up';
    }

    // Update medical inflation in assumptions
    const medPct = Math.round(state.medicalInflation * 100) + '%';
    ['assumption-med-c', 'assumption-med-b', 'assumption-med-o'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Healthcare inflation: ' + medPct;
    });
    const postPct = (postReturnRate * 100).toFixed(1) + '%';
    ['assumption-post-c', 'assumption-post-b', 'assumption-post-o'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Post-retirement return: ' + postPct;
    });
    ['assumption-years-c', 'assumption-years-b', 'assumption-years-o'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Years in retirement: ' + retirementDuration;
    });
    const lifePct = (state.lifestyleInflation * 100).toFixed(1).replace('.0', '') + '%';
    ['assumption-life-c', 'assumption-life-b', 'assumption-life-o'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Lifestyle inflation: ' + lifePct;
    });
    document.getElementById('assumption-pre-c').innerHTML = 'Pre-retirement return: <strong>' + (state.conservativeReturn * 100).toFixed(1) + '%</strong>';
    document.getElementById('assumption-pre-b').innerHTML = 'Pre-retirement return: <strong>' + (state.baselineReturn * 100).toFixed(1) + '%</strong>';
    document.getElementById('assumption-pre-o').innerHTML = 'Pre-retirement return: <strong>' + (state.optimisticReturn * 100).toFixed(1) + '%</strong>';

    const scenarioResults = {};

    // Calculate each scenario
    scenarios.forEach(sc => {
      let accumulated;
      if (state.stepUpEnabled) {
        accumulated = calcStepUpAccumulation(startingSIP, sc.rate, years, state.annualRaise, state.sipCeiling);
      } else {
        accumulated = calcFlatAccumulation(startingSIP, sc.rate, years);
      }

      const corpusEl = document.getElementById('corpus-' + sc.id);
      const gapEl = document.getElementById('gap-' + sc.id);

      corpusEl.setAttribute('data-target', accumulated);
      corpusEl.textContent = formatCorpus(accumulated);
      scenarioResults[sc.id] = accumulated;

      const diff = accumulated - targetCorpus;
      if (sc.id === 'conservative') {
        if (diff < 0) {
          gapEl.innerHTML = '<strong>Indicative shortfall: ' + formatCorpus(Math.abs(diff)) + ' below target</strong><span>Consider adjusting SIP or retirement age</span>';
        } else {
          gapEl.innerHTML = '<strong>Indicative target match</strong><span>Within conservative return assumptions</span>';
        }
      } else if (sc.id === 'baseline') {
        if (diff >= 0) {
          gapEl.innerHTML = '<strong>Indicatively aligned to goal</strong><span>Based on baseline market assumptions</span>';
        } else {
          gapEl.innerHTML = '<strong>Indicative shortfall: ' + formatCorpus(Math.abs(diff)) + '</strong><span>Try adjusting assumptions in What-If controls</span>';
        }
      } else {
        if (diff > 0) {
          gapEl.innerHTML = '<strong>Indicative surplus: +' + formatCorpus(diff) + ' above target</strong><span>Potential additional cushion under optimistic returns</span>';
        } else {
          gapEl.innerHTML = '<strong>Near target in optimistic case</strong><span>Review contribution and timeline assumptions</span>';
        }
      }
    });

    // --- Generate Smart Narrative ---
    const narrativeEl = document.getElementById('smart-narrative-text');
    const geoText = state.geoModifier === 1.0 ? "staying in the Metro" : (state.geoModifier === 0.75 ? "moving to a Tier-2 city" : "retiring in the countryside");
    const healthText = state.healthcareRatio >= 0.25
      ? `buffering for ${(state.medicalInflation * 100).toFixed(1).replace('.0', '')}% medical inflation`
      : `using ${(state.lifestyleInflation * 100).toFixed(1).replace('.0', '')}% lifestyle inflation assumptions`;
    const stepUpText = state.stepUpEnabled ? `leveraging your career growth with a ${Math.round(state.annualRaise * 100)}% annual SIP step-up` : "using a flat monthly contribution";

    const narrativeString = `By planning to retire at ${state.whatIfRetireAge || state.retirementAge} and ${geoText}, you are shaping a realistic retirement path. You are ${healthText} and ${stepUpText}. This \u201CLife-Proof\u201D view is illustrative and helps you compare trade-offs responsibly.`;

    narrativeEl.innerHTML = '';
    if (narrativeTimer) {
      clearTimeout(narrativeTimer);
      narrativeTimer = null;
    }
    narrativeSequence += 1;
    const currentSequence = narrativeSequence;
    if (prefersReducedMotion()) {
      narrativeEl.textContent = narrativeString;
      updateURLState();
      updateEverydayTranslator();
      updateInsightStrip(targetCorpus, startingSIP, years);
      return;
    }
    let charIdx = 0;
    function typeWriter() {
      if (currentSequence !== narrativeSequence) return;
      if (charIdx < narrativeString.length) {
        narrativeEl.innerHTML += narrativeString.charAt(charIdx);
        charIdx++;
        narrativeTimer = setTimeout(typeWriter, 20);
      }
    }
    narrativeTimer = setTimeout(typeWriter, 180);

    updateURLState();
    updateEverydayTranslator();
    updateInsightStrip(targetCorpus, startingSIP, years);
    updateAffordabilityLens(startingSIP, targetCorpus);
    updateStressTestCards();
    updateMilestoneStory();
    updateSnapshotDiff();
  }

  function updateAffordabilityLens(startingSIP, targetCorpus) {
    const shareEl = document.getElementById('affordability-share');
    const nextYearEl = document.getElementById('affordability-next-year');
    const targetEl = document.getElementById('affordability-target');
    if (!shareEl || !nextYearEl || !targetEl) return;

    const share = (startingSIP / Math.max(1, state.monthlyExpenses)) * 100;
    const nextYear = state.stepUpEnabled ? startingSIP * (1 + state.annualRaise) : startingSIP;
    shareEl.textContent = share.toFixed(0) + '%';
    nextYearEl.textContent = formatCurrency(Math.round(nextYear)) + '/mo';
    targetEl.textContent = formatCorpus(targetCorpus);
  }

  function evaluatePlan(overrides) {
    const currentRetireAge = overrides.retireAge ?? (state.whatIfRetireAge || state.retirementAge);
    const years = currentRetireAge - state.currentAge;
    const annualExpense = state.monthlyExpenses * 12;
    const lifestyleInflation = overrides.lifestyleInflation ?? state.lifestyleInflation;
    const medicalInflation = overrides.medicalInflation ?? state.medicalInflation;
    const geoModifier = overrides.geoModifier ?? state.geoModifier;
    const postReturn = overrides.postReturn ?? (state.whatIfPostRetirementReturn || state.postRetirementReturn);
    const retirementYears = overrides.retirementYears ?? (state.whatIfRetirementDuration || state.retirementDuration);
    const conservativeReturn = overrides.conservativeReturn ?? state.conservativeReturn;
    const baselineReturn = overrides.baselineReturn ?? state.baselineReturn;
    const optimisticReturn = overrides.optimisticReturn ?? state.optimisticReturn;

    const futureExpense = calcFutureExpense(annualExpense, state.healthcareRatio, lifestyleInflation, medicalInflation, years);
    const targetCorpus = calcCorpus(futureExpense * geoModifier, postReturn, retirementYears);
    const useManualSip = !overrides.ignoreWhatIfSIP && state.whatIfSIP !== null;
    const startingSIP = overrides.startingSIP ?? (useManualSip ? state.whatIfSIP : (state.stepUpEnabled
      ? calcStepUpSIP(targetCorpus, baselineReturn, years, state.annualRaise, state.sipCeiling)
      : calcFlatSIP(targetCorpus, baselineReturn, years)));
    const baselineCorpus = state.stepUpEnabled
      ? calcStepUpAccumulation(startingSIP, baselineReturn, years, state.annualRaise, state.sipCeiling)
      : calcFlatAccumulation(startingSIP, baselineReturn, years);
    return { years, targetCorpus, startingSIP, baselineCorpus, conservativeReturn, baselineReturn, optimisticReturn };
  }

  function updateStressTestCards() {
    // Current Reference: Use the STABLE reference point saved when NOT in a stress test
    const ref = state.stressReference;
    const baselineInput = {
      ignoreWhatIfSIP: true,
      retireAge: ref.retireAge,
      conservativeReturn: ref.conservativeReturnPct / 100,
      baselineReturn: ref.baselineReturnPct / 100,
      optimisticReturn: ref.optimisticReturnPct / 100
    };

    const current = evaluatePlan(baselineInput);
    const medical = evaluatePlan({ ...baselineInput, medicalInflation: 0.16 });
    const early = evaluatePlan({ ...baselineInput, retireAge: Math.max(state.currentAge + 1, baselineInput.retireAge - 3) });
    const lower = evaluatePlan({ ...baselineInput, conservativeReturn: Math.max(0.01, baselineInput.conservativeReturn - 0.02), baselineReturn: Math.max(0.01, baselineInput.baselineReturn - 0.02), optimisticReturn: Math.max(0.01, baselineInput.optimisticReturn - 0.02) });

    const medEl = document.getElementById('stress-medical');
    const earlyEl = document.getElementById('stress-early');
    const lowerEl = document.getElementById('stress-return');
    if (medEl) medEl.textContent = formatSignedCurrency(medical.startingSIP - current.startingSIP) + '/mo';
    if (earlyEl) earlyEl.textContent = formatSignedCurrency(early.startingSIP - current.startingSIP) + '/mo';
    if (lowerEl) lowerEl.textContent = formatSignedCurrency(lower.startingSIP - current.startingSIP) + '/mo';
  }

  window.runStressTest = function (type) {
    if (state.stressReference.retireAge === null) {
      updateStressReferenceFromUI();
    }

    const ref = state.stressReference;
    if (type === 'medical-spike') {
      updateMedicalInflation(16);
      const medSlider = document.getElementById('medical-inflation');
      if (medSlider) { medSlider.value = 16; updateSliderTrack(medSlider); }
    } else if (type === 'retire-early') {
      setRangeValue('whatif-retire-age', Math.max(state.currentAge + 1, ref.retireAge - 3));
    } else if (type === 'returns-lower') {
      setRangeValue('whatif-conservative-return', Math.max(1, ref.conservativeReturnPct - 2));
      setRangeValue('whatif-baseline-return', Math.max(1, ref.baselineReturnPct - 2));
      setRangeValue('whatif-optimistic-return', Math.max(1, ref.optimisticReturnPct - 2));
    }
    onWhatIfChange('stress');
    announceStatus('Stress test applied: ' + type.replace('-', ' ') + '.');
  };

  function updateMilestoneStory() {
    const storyEl = document.getElementById('milestone-story-text');
    const m1 = document.getElementById('milestone-1cr')?.textContent;
    const m5 = document.getElementById('milestone-5cr')?.textContent;
    const m10 = document.getElementById('milestone-10cr')?.textContent;
    if (!storyEl) return;
    storyEl.textContent = 'Your baseline path reaches ₹1Cr by ' + m1 + ', scales to ₹5Cr by ' + m5 + ', and approaches ₹10Cr by ' + m10 + '. Use the quick chips and stress tests to see how those milestones shift under different life choices.';
  }

  function updateDeltaSummary(previousSnapshot, currentSnapshot) {
    const deltaEl = document.getElementById('delta-summary-text');
    if (!deltaEl || !previousSnapshot || !currentSnapshot) return;
    const deltas = [];
    if (previousSnapshot.sip !== currentSnapshot.sip) deltas.push('Starting SIP ' + (currentSnapshot.sip > previousSnapshot.sip ? 'increased' : 'decreased') + ' by ' + formatCurrency(Math.abs(currentSnapshot.sip - previousSnapshot.sip)));
    if (previousSnapshot.retireAge !== currentSnapshot.retireAge) deltas.push('retirement age moved by ' + Math.abs(currentSnapshot.retireAge - previousSnapshot.retireAge) + ' years');
    if (previousSnapshot.baselineReturn !== currentSnapshot.baselineReturn) deltas.push('baseline return changed by ' + Math.abs(currentSnapshot.baselineReturn - previousSnapshot.baselineReturn).toFixed(1) + '%');
    if (previousSnapshot.lifestyleInflation !== currentSnapshot.lifestyleInflation) deltas.push('lifestyle inflation shifted by ' + Math.abs(currentSnapshot.lifestyleInflation - previousSnapshot.lifestyleInflation).toFixed(1) + '%');
    if (previousSnapshot.geoModifier !== currentSnapshot.geoModifier) deltas.push('retirement geography changed');
    deltaEl.textContent = deltas.length ? deltas.join(', ') + '.' : 'Adjust a control to see how your plan shifts.';
  }

  window.savePlanSnapshot = function (slot) {
    const currentRetireAge = state.whatIfRetireAge || state.retirementAge;
    const result = evaluatePlan({});
    const snapshot = {
      title: formatCurrency(Math.round(result.startingSIP)) + '/mo at age ' + currentRetireAge,
      meta: 'Target corpus ' + formatCorpus(result.targetCorpus) + ' | Lifestyle inflation ' + (state.lifestyleInflation * 100).toFixed(1) + '% | Geo ' + (state.geoModifier === 1 ? 'Metro' : state.geoModifier === 0.75 ? 'Tier-2' : 'Hometown'),
      sip: result.startingSIP,
      corpus: result.targetCorpus,
    };
    state.planSnapshots[slot] = snapshot;
    document.getElementById('snapshot-' + slot.toLowerCase() + '-title').textContent = snapshot.title;
    document.getElementById('snapshot-' + slot.toLowerCase() + '-meta').textContent = snapshot.meta;
    updateSnapshotDiff();
    announceStatus('Saved current plan as Plan ' + slot + '.');
  };

  function updateSnapshotDiff() {
    const diffEl = document.getElementById('snapshot-diff');
    const a = state.planSnapshots.A;
    const b = state.planSnapshots.B;
    if (!diffEl) return;
    if (!a || !b) {
      diffEl.textContent = 'Save both plans to unlock a side-by-side recommendation.';
      return;
    }
    const cheaper = a.sip <= b.sip ? 'Plan A' : 'Plan B';
    const sipGap = Math.abs(a.sip - b.sip);
    const corpusGap = Math.abs(a.corpus - b.corpus);
    diffEl.textContent = cheaper + ' needs ' + formatCurrency(Math.round(sipGap)) + '/mo less, while the target corpus differs by ' + formatCorpus(corpusGap) + '.';
  }

  function clearDemoTimers() {
    state.demoTimers.forEach(timer => clearTimeout(timer));
    state.demoTimers = [];
  }

  function updateInsightStrip(targetCorpus, startingSIP, years) {
    const inflationImpactEl = document.getElementById('insight-inflation-impact');
    const returnSensitivityEl = document.getElementById('insight-return-sensitivity');
    const contributionOutlookEl = document.getElementById('insight-contribution-outlook');
    if (!inflationImpactEl || !returnSensitivityEl || !contributionOutlookEl) return;

    const annualExpense = state.monthlyExpenses * 12;
    const inflatedAtCurrent = calcFutureExpense(annualExpense, state.healthcareRatio, state.lifestyleInflation, state.medicalInflation, years) * state.geoModifier;
    const inflatedAtHigher = calcFutureExpense(annualExpense, state.healthcareRatio, state.lifestyleInflation + 0.01, state.medicalInflation, years) * state.geoModifier;
    const corpusHigherInflation = calcCorpus(inflatedAtHigher, state.whatIfPostRetirementReturn || state.postRetirementReturn, state.whatIfRetirementDuration || state.retirementDuration);
    const inflationDelta = Math.max(0, corpusHigherInflation - targetCorpus);
    inflationImpactEl.textContent = '+1% inflation may add ' + formatCorpusShort(inflationDelta) + ' corpus need';

    const lowerRate = Math.max(0.01, state.baselineReturn - 0.01);
    const upperRate = state.baselineReturn + 0.01;
    const lowAccum = state.stepUpEnabled
      ? calcStepUpAccumulation(startingSIP, lowerRate, years, state.annualRaise, state.sipCeiling)
      : calcFlatAccumulation(startingSIP, lowerRate, years);
    const highAccum = state.stepUpEnabled
      ? calcStepUpAccumulation(startingSIP, upperRate, years, state.annualRaise, state.sipCeiling)
      : calcFlatAccumulation(startingSIP, upperRate, years);
    returnSensitivityEl.textContent = '±1% return shifts corpus by about ' + formatCorpusShort(Math.abs(highAccum - lowAccum));

    const monthShare = Math.min(100, Math.max(1, (startingSIP / Math.max(1, state.monthlyExpenses)) * 100));
    contributionOutlookEl.textContent = 'Starting SIP is ~' + monthShare.toFixed(0) + '% of current monthly expenses';
  }

  function updateEverydayTranslator() {
    const translatorEl = document.getElementById('everyday-translator');
    const transText = document.getElementById('translator-text');
    const sipInput = document.getElementById('whatif-sip');
    if (!translatorEl || !transText || !sipInput) return;

    const currentSip = parseInt(sipInput.value) || 0;
    const diff = currentSip - 8500;
    const years = (state.whatIfRetireAge || state.retirementAge) - state.currentAge;

    if (diff > 0 && years > 0) {
      const coffees = Math.max(1, Math.floor(diff / 300));
      const extraCorpus = calcFlatAccumulation(diff, state.baselineReturn, years);
      translatorEl.classList.add('show');
      transText.innerHTML = 'Adding ' + formatCurrency(diff) + '/mo is roughly <strong>' + coffees + ' cafe visits</strong>, but it adds <strong>' + formatCorpus(extraCorpus) + '</strong> to your retirement!';
    } else if (diff < 0 && years > 0) {
      const reducedCorpus = calcFlatAccumulation(Math.abs(diff), state.baselineReturn, years);
      translatorEl.classList.add('show');
      transText.innerHTML = 'Reducing SIP by ' + formatCurrency(Math.abs(diff)) + '/mo may lower your Baseline corpus by <strong>' + formatCorpus(reducedCorpus) + '</strong>.';
    } else {
      translatorEl.classList.remove('show');
    }
  }

  window.playJourney = function () {
    const years = (state.whatIfRetireAge || state.retirementAge) - state.currentAge;
    const canvas = document.getElementById('growthCanvas');
    const scrubber = document.getElementById('chart-scrubber-line');
    if (!canvas || !scrubber || years <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const PAD = { left: 80, right: 30 };
    const chartW = rect.width - PAD.left - PAD.right;
    let currentYear = 0;

    if (journeyTimer) clearInterval(journeyTimer);
    scrubber.style.opacity = '1';

    journeyTimer = setInterval(() => {
      if (currentYear > years) {
        clearInterval(journeyTimer);
        journeyTimer = null;
        scrubber.style.opacity = '0';
        canvas.dispatchEvent(new MouseEvent('mouseleave'));
        return;
      }

      const simulatedX = PAD.left + (currentYear / years) * chartW;
      scrubber.style.left = simulatedX + 'px';

      const event = new MouseEvent('mousemove', {
        clientX: rect.left + simulatedX,
        clientY: rect.top + 100
      });
      canvas.dispatchEvent(event);
      currentYear++;
    }, 90);
  };

  // --- Dynamic URL Generation ---
  function updateURLState() {
    const params = new URLSearchParams();
    params.set('age', state.currentAge);
    params.set('retire', state.retirementAge);
    params.set('exp', state.monthlyExpenses);
    params.set('geo', state.geoModifier);
    params.set('post', (state.whatIfPostRetirementReturn || state.postRetirementReturn).toFixed(3));
    params.set('ryears', (state.whatIfRetirementDuration || state.retirementDuration));
    params.set('lifeinf', state.lifestyleInflation.toFixed(3));
    params.set('rc', state.conservativeReturn.toFixed(3));
    params.set('rb', state.baselineReturn.toFixed(3));
    params.set('ro', state.optimisticReturn.toFixed(3));
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
  }

  // ===== FINANCIAL FORMULAS =====

  // Dual-track inflation
  function calcFutureExpense(annualExpense, healthcareRatio, lifestyleInf, medicalInf, years) {
    const standard = annualExpense * (1 - healthcareRatio) * Math.pow(1 + lifestyleInf, years);
    const healthcare = annualExpense * healthcareRatio * Math.pow(1 + medicalInf, years);
    return standard + healthcare;
  }

  // PV of annuity — Required corpus
  function calcCorpus(futureAnnualExpense, postReturnRate, retirementDuration) {
    return futureAnnualExpense * ((1 - Math.pow(1 + postReturnRate, -retirementDuration)) / postReturnRate);
  }

  // Flat SIP to reach target
  function calcFlatSIP(targetCorpus, annualReturn, years) {
    const r = annualReturn / 12;
    const n = years * 12;
    return targetCorpus * r / ((Math.pow(1 + r, n) - 1) * (1 + r));
  }

  // Step-Up SIP: binary search for initial SIP
  function calcStepUpSIP(targetCorpus, annualReturn, years, stepUpRate, ceilingPct) {
    let low = 100, high = 500000;
    for (let iter = 0; iter < 100; iter++) {
      const mid = (low + high) / 2;
      const acc = calcStepUpAccumulation(mid, annualReturn, years, stepUpRate, ceilingPct);
      if (acc < targetCorpus) low = mid;
      else high = mid;
      if (Math.abs(high - low) < 1) break;
    }
    return Math.round((low + high) / 2);
  }

  // Accumulation with step-up (with SIP ceiling enforcement)
  function calcStepUpAccumulation(initialSIP, annualReturn, years, stepUpRate, ceilingPct) {
    const monthlyReturn = annualReturn / 12;
    let total = 0;
    let sip = initialSIP;

    // We model the SIP ceiling as a percentage of salary.
    // Assuming starting SIP is ~10-15% of salary, 40% ceiling means SIP can grow ~3-4x.
    // ceilingPct is 0.40 (40%), so ceiling multiplier is roughly ceilingPct * 10
    const ceilingMultiplier = ceilingPct * 10;
    const maxAbsoluteSIP = initialSIP * ceilingMultiplier;

    for (let y = 1; y <= years; y++) {
      const yearFV = sip * ((Math.pow(1 + monthlyReturn, 12) - 1) / monthlyReturn) * (1 + monthlyReturn);
      const yearsRemaining = years - y;
      total += yearFV * Math.pow(1 + annualReturn, yearsRemaining);
      sip = Math.min(sip * (1 + stepUpRate), maxAbsoluteSIP);
    }
    return total;
  }

  // Flat accumulation
  function calcFlatAccumulation(monthlySIP, annualReturn, years) {
    const r = annualReturn / 12;
    const n = years * 12;
    return monthlySIP * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  }

  // ===== FORMATTING =====
  function formatCurrency(num) {
    if (num === undefined || num === null || isNaN(num)) return '₹0';
    return '₹' + num.toLocaleString('en-IN');
  }

  function formatCorpus(num) {
    if (num >= 10000000) {
      return '₹' + (num / 10000000).toFixed(1) + ' Crores';
    } else if (num >= 100000) {
      return '₹' + (num / 100000).toFixed(1) + ' Lakhs';
    }
    return formatCurrency(Math.round(num));
  }

  // ===== COUNT-UP ANIMATION =====
  function animateCountUp() {
    const els = document.querySelectorAll('.corpus-value[id^="corpus-"]');
    els.forEach(el => {
      const target = parseFloat(el.getAttribute('data-target'));
      if (!target) return;
      if (prefersReducedMotion()) {
        el.textContent = formatCorpus(target);
        return;
      }
      const duration = 2000;
      const start = performance.now();
      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out
        const current = target * eased;
        el.textContent = formatCorpus(current);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // ===== CHART DRAWING =====
  function drawChart() {
    const canvas = document.getElementById('growthCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Responsive sizing
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 280 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '280px';
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = 280;
    const PAD = { top: 30, right: 30, bottom: 40, left: 80 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);

    const years = (state.whatIfRetireAge || state.retirementAge) - state.currentAge;
    if (years <= 0) return;

    const startingSIP = parseInt(document.getElementById('whatif-sip').value) || 8500;
    const rates = [
      { rate: state.conservativeReturn, color: '#ff9800', label: 'Conservative' },
      { rate: state.baselineReturn, color: '#224c87', label: 'Baseline' },
      { rate: state.optimisticReturn, color: '#2e7d32', label: 'Optimistic' },
    ];

    // Better approach: track actual accumulation at each year
    const seriesData = rates.map(sc => {
      const points = [];
      let sip = startingSIP;
      const monthlyReturn = sc.rate / 12;
      let totalAccum = 0;
      for (let y = 0; y <= years; y++) {
        if (y > 0) {
          // Previous year SIP contribution compounded to this point
          const prevSIP = state.stepUpEnabled ? startingSIP * Math.pow(1 + state.annualRaise, y - 1) : startingSIP;
          const yearFV = prevSIP * ((Math.pow(1 + monthlyReturn, 12) - 1) / monthlyReturn) * (1 + monthlyReturn);
          totalAccum = totalAccum * (1 + sc.rate) + yearFV;
        }
        points.push({ year: y, value: totalAccum });
      }
      return { points, color: sc.color };
    });

    const kpiCons = document.getElementById('kpi-conservative');
    const kpiBase = document.getElementById('kpi-baseline');
    const kpiOpt = document.getElementById('kpi-optimistic');
    const kpiGap = document.getElementById('kpi-gap');
    if (kpiCons && kpiBase && kpiOpt && kpiGap) {
      const conservativeEnd = seriesData[0].points[seriesData[0].points.length - 1].value;
      const baselineEnd = seriesData[1].points[seriesData[1].points.length - 1].value;
      const optimisticEnd = seriesData[2].points[seriesData[2].points.length - 1].value;
      kpiCons.textContent = formatCorpusShort(conservativeEnd);
      kpiBase.textContent = formatCorpusShort(baselineEnd);
      kpiOpt.textContent = formatCorpusShort(optimisticEnd);
      kpiGap.textContent = formatCorpusShort(Math.max(0, optimisticEnd - baselineEnd));
    }

    const baselinePoints = seriesData[1].points;
    const milestone1El = document.getElementById('milestone-1cr');
    const milestone5El = document.getElementById('milestone-5cr');
    const milestone10El = document.getElementById('milestone-10cr');
    if (milestone1El && milestone5El && milestone10El) {
      const m1 = baselinePoints.find(p => p.value >= 10000000);
      const m5 = baselinePoints.find(p => p.value >= 50000000);
      const m10 = baselinePoints.find(p => p.value >= 100000000);
      milestone1El.textContent = m1 ? ('Year ' + m1.year) : 'Beyond horizon';
      milestone5El.textContent = m5 ? ('Year ' + m5.year) : 'Beyond horizon';
      milestone10El.textContent = m10 ? ('Year ' + m10.year) : 'Beyond horizon';
    }

    // Find max value
    let maxVal = 0;
    seriesData.forEach(s => s.points.forEach(p => { if (p.value > maxVal) maxVal = p.value; }));
    if (maxVal === 0) maxVal = 1;

    // Chart plot backdrop
    const plotGradient = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
    plotGradient.addColorStop(0, 'rgba(34, 76, 135, 0.08)');
    plotGradient.addColorStop(1, 'rgba(34, 76, 135, 0.02)');
    ctx.fillStyle = plotGradient;
    ctx.fillRect(PAD.left, PAD.top, chartW, chartH);

    // Grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const y = PAD.top + chartH - (i / gridSteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
      // Labels
      ctx.fillStyle = '#919090';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      const val = (maxVal * i) / gridSteps;
      ctx.fillText(formatCorpusShort(val), PAD.left - 8, y + 4);
    }
    ctx.setLineDash([]);

    // Axes
    ctx.strokeStyle = 'rgba(27, 61, 110, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top + chartH);
    ctx.lineTo(PAD.left + chartW, PAD.top + chartH);
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, PAD.top + chartH);
    ctx.stroke();

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.fillStyle = '#919090';
    const xSteps = Math.min(years, 6);
    for (let i = 0; i <= xSteps; i++) {
      const yr = Math.round((i / xSteps) * years);
      const x = PAD.left + (yr / years) * chartW;
      ctx.fillText('Year ' + yr, x, H - 10);
    }

    // Draw lines (conservative first, then baseline thicker, then optimistic)
    const order = [0, 2, 1]; // draw baseline last (on top)
    order.forEach(idx => {
      const series = seriesData[idx];
      const lineWidth = idx === 1 ? 3.5 : 2;

      ctx.beginPath();
      ctx.strokeStyle = series.color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      series.points.forEach((p, i) => {
        const x = PAD.left + (p.year / years) * chartW;
        const y = PAD.top + chartH - (p.value / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Filled area (subtle)
      ctx.globalAlpha = 0.08;
      ctx.lineTo(PAD.left + chartW, PAD.top + chartH);
      ctx.lineTo(PAD.left, PAD.top + chartH);
      ctx.closePath();
      ctx.fillStyle = series.color;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Data points
      series.points.forEach((p, i) => {
        if (i % Math.max(1, Math.floor(years / 5)) === 0 || i === series.points.length - 1) {
          const x = PAD.left + (p.year / years) * chartW;
          const y = PAD.top + chartH - (p.value / maxVal) * chartH;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = series.color;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      // Endpoint emphasis
      const end = series.points[series.points.length - 1];
      const endX = PAD.left + (end.year / years) * chartW;
      const endY = PAD.top + chartH - (end.value / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(endX, endY, idx === 1 ? 5.5 : 4.8, 0, Math.PI * 2);
      ctx.fillStyle = series.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    // --- Canvas Hover Tooltip (Scrubber) ---
    let tooltipEl = document.getElementById('chart-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'chart-tooltip';
      tooltipEl.style.cssText = 'position:absolute; background:rgba(10,47,102,0.96); color:white; padding:10px 12px; border-radius:10px; font-size:12px; pointer-events:none; opacity:0; transition:opacity 0.2s; z-index:10; transform:translate(-50%, -100%); margin-top:-12px; font-family:Montserrat, sans-serif; box-shadow:0 12px 24px rgba(0,0,0,0.24); min-width:180px;';
      canvas.parentNode.style.position = 'relative';
      canvas.parentNode.appendChild(tooltipEl);
    }

    canvas.onmousemove = function handleChartHover(e) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      if (mouseX >= PAD.left && mouseX <= PAD.left + chartW) {
        const pct = (mouseX - PAD.left) / chartW;
        const hoverYear = Math.round(pct * years);
        const cPoint = seriesData[0].points.find(p => p.year === hoverYear);
        const bPoint = seriesData[1].points.find(p => p.year === hoverYear);
        const oPoint = seriesData[2].points.find(p => p.year === hoverYear);
        if (cPoint && bPoint && oPoint) {
          tooltipEl.style.opacity = '1';
          tooltipEl.style.left = mouseX + 'px';
          tooltipEl.style.top = (e.clientY - rect.top) + 'px';
          tooltipEl.innerHTML =
            '<strong style="display:block;margin-bottom:6px;">Year ' + hoverYear + '</strong>' +
            '<div style="display:flex;justify-content:space-between;gap:10px;"><span style="color:#ffd180;">Conservative</span><strong>' + formatCorpusShort(cPoint.value) + '</strong></div>' +
            '<div style="display:flex;justify-content:space-between;gap:10px;"><span style="color:#cde2ff;">Baseline</span><strong>' + formatCorpusShort(bPoint.value) + '</strong></div>' +
            '<div style="display:flex;justify-content:space-between;gap:10px;"><span style="color:#c8f0d5;">Optimistic</span><strong>' + formatCorpusShort(oPoint.value) + '</strong></div>';
        }
      } else {
        tooltipEl.style.opacity = '0';
      }
    };
    canvas.onmouseleave = function () { tooltipEl.style.opacity = '0'; };
  }

  function formatCorpusShort(num) {
    if (num >= 10000000) return (num / 10000000).toFixed(1) + 'Cr';
    if (num >= 100000) return (num / 100000).toFixed(0) + 'L';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return Math.round(num).toString();
  }

  function formatSignedCurrency(num) {
    const rounded = Math.round(num);
    return (rounded >= 0 ? '+' : '-') + formatCurrency(Math.abs(rounded));
  }

  // ===== TOAST NOTIFICATIONS =====
  window.showToast = function (type, title, body, actionText) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    const iconSvg = type === 'error'
      ? '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 4l12 22H4L16 4z" stroke="#da3832" stroke-width="2" fill="#ffebee"/><path d="M16 14v5M16 21v1" stroke="#da3832" stroke-width="2" stroke-linecap="round"/></svg>'
      : type === 'warning'
        ? '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="#ff9800" stroke-width="2" fill="#fff3cd"/><path d="M16 10v7M16 20v1" stroke="#ff9800" stroke-width="2" stroke-linecap="round"/></svg>'
        : '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="#2e7d32" stroke-width="2" fill="#e8f5e9"/><path d="M11 16l3 3 7-7" stroke="#2e7d32" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    let html = '<div class="toast-header">' + iconSvg +
      '<span class="toast-title">' + escapeHtml(title) + '</span>' +
      '<button class="toast-close" onclick="this.closest(\'.toast\').classList.add(\'exit\');setTimeout(()=>this.closest(\'.toast\').remove(),200)" aria-label="Close notification">' +
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>';
    html += '<div class="toast-body">' + escapeHtml(body) + '</div>';
    if (actionText) {
      html += '<button class="toast-action" onclick="this.closest(\'.toast\').classList.add(\'exit\');setTimeout(()=>this.closest(\'.toast\').remove(),200)">' + escapeHtml(actionText) + '</button>';
    }
    html += '<div class="toast-progress"></div>';

    toast.innerHTML = html;
    container.appendChild(toast);

    // Auto-dismiss
    const timer = setTimeout(() => {
      toast.classList.add('exit');
      setTimeout(() => toast.remove(), 200);
    }, 6000);

    // Pause on hover
    toast.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      const prog = toast.querySelector('.toast-progress');
      if (prog) prog.style.animationPlayState = 'paused';
    });
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== DISCLAIMER TOGGLE =====
  window.toggleDisclaimer = function () {
    const footer = document.querySelector('.disclaimer-footer');
    footer.classList.toggle('collapsed');
    const btn = document.getElementById('disclaimer-toggle');
    btn.setAttribute('aria-expanded', !footer.classList.contains('collapsed'));
  };

  // ===== WINDOW RESIZE =====
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (document.getElementById('step-4').classList.contains('active')) {
        drawChart();
      }
    }, 200);
  });

})();
