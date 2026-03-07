// ===== Life-Proof Retirement Calculator =====
// Core application logic with dual-track inflation, step-up SIP,
// geo-arbitrage, and 3-scenario modeling.

(function () {
  'use strict';

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
    // What-If overrides
    whatIfSIP: null,
    whatIfRetireAge: null,
  };

  // ===== NAVIGATION =====
  window.goToStep = function (stepNum) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const id = stepNum === 0 ? 'step-landing' : 'step-' + stepNum;
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const inflated = expenses * Math.pow(1.06, years);
    document.getElementById('inflated-amount').textContent = formatCurrency(Math.round(inflated));
    document.getElementById('inflation-years').textContent = years;
  }

  // Wire Step 1 inputs
  document.addEventListener('DOMContentLoaded', function () {
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
    syncStep1UI();
  });

  // ===== VALIDATION =====
  window.validateAndGoStep2 = function () {
    const age = parseInt(document.getElementById('current-age').value);
    const retire = parseInt(document.getElementById('retirement-age').value);
    const expenses = parseInt(document.getElementById('monthly-expenses').value);

    if (!age || age < 18 || age > 65) {
      document.getElementById('current-age').classList.add('error');
      showToast('error', 'Invalid Age', 'Current age must be between 18 and 65 years.', 'Fix Ages');
      return;
    }
    document.getElementById('current-age').classList.remove('error');

    if (!retire || retire <= age) {
      document.getElementById('retirement-age').classList.add('error');
      showToast('error', 'Time Flows Forward', 'Your retirement age needs to be after your current age. Most people retire between 58–65 in India.', 'Fix Ages');
      return;
    }
    document.getElementById('retirement-age').classList.remove('error');

    if (!expenses || expenses < 10000 || expenses > 200000) {
      showToast('warning', "Let's Be Realistic", 'Monthly expenses should be between ₹10,000 and ₹2,00,000 for this calculator.', 'Adjust');
      return;
    }

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

  window.selectLocation = function (el, value) {
    document.querySelectorAll('.location-card').forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-checked', 'false');
    });
    el.classList.add('selected');
    el.setAttribute('aria-checked', 'true');
    state.geoModifier = value;
    updateGeoImpact();
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
    const corpus = calcCorpus(geoAdjusted, 0.07, 25);

    // Traditional (flat) SIP
    const tradSIP = calcFlatSIP(corpus, 0.12, years);
    // Step-Up SIP
    const stepSIP = state.stepUpEnabled ? calcStepUpSIP(corpus, 0.12, years, state.annualRaise, state.sipCeiling) : tradSIP;

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
    runFullCalculation();
    goToStep(4);
    setTimeout(animateCountUp, 200);
    setTimeout(drawChart, 400);
  };

  window.onWhatIfChange = function () {
    const sipVal = parseInt(document.getElementById('whatif-sip').value);
    const retireVal = parseInt(document.getElementById('whatif-retire-age').value);
    document.getElementById('whatif-sip-display').textContent = formatCurrency(sipVal);
    document.getElementById('whatif-retire-display').textContent = retireVal;
    updateSliderTrack(document.getElementById('whatif-sip'));
    updateSliderTrack(document.getElementById('whatif-retire-age'));
    state.whatIfSIP = sipVal;
    state.whatIfRetireAge = retireVal;
    runFullCalculation();
    drawChart();
  };

  function runFullCalculation() {
    const years = (state.whatIfRetireAge || state.retirementAge) - state.currentAge;
    if (years <= 0) return;

    const annualExpense = state.monthlyExpenses * 12;
    const futureExpense = calcFutureExpense(annualExpense, state.healthcareRatio, state.lifestyleInflation, state.medicalInflation, years);
    const geoAdjusted = futureExpense * state.geoModifier;
    const targetCorpus = calcCorpus(geoAdjusted, 0.07, 25);

    const scenarios = [
      { rate: 0.06, id: 'conservative', label: 'Conservative' },
      { rate: 0.12, id: 'baseline', label: 'Baseline' },
      { rate: 0.15, id: 'optimistic', label: 'Optimistic' },
    ];

    // Determine starting SIP
    let startingSIP;
    if (state.whatIfSIP) {
      startingSIP = state.whatIfSIP;
    } else if (state.stepUpEnabled) {
      startingSIP = calcStepUpSIP(targetCorpus, 0.12, years, state.annualRaise, state.sipCeiling);
    } else {
      startingSIP = calcFlatSIP(targetCorpus, 0.12, years);
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

    // Summary
    document.getElementById('result-starting-sip').textContent = formatCurrency(Math.round(startingSIP)) + '/month';
    if (state.stepUpEnabled) {
      const capYear = Math.min(years, Math.ceil(Math.log(targetCorpus * 0.001 / startingSIP) / Math.log(1 + state.annualRaise)));
      const cappedSIP = startingSIP * Math.pow(1 + state.annualRaise, Math.min(15, years));
      document.getElementById('result-growth-note').innerHTML =
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 14l4-4 3 3 5-7" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
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

    // Calculate each scenario
    scenarios.forEach(sc => {
      let accumulated;
      if (state.stepUpEnabled) {
        accumulated = calcStepUpAccumulation(startingSIP, sc.rate, years, state.annualRaise);
      } else {
        accumulated = calcFlatAccumulation(startingSIP, sc.rate, years);
      }

      const corpusEl = document.getElementById('corpus-' + sc.id);
      const gapEl = document.getElementById('gap-' + sc.id);

      corpusEl.setAttribute('data-target', accumulated);
      corpusEl.textContent = formatCorpus(accumulated);

      const diff = accumulated - targetCorpus;
      if (sc.id === 'conservative') {
        if (diff < 0) {
          gapEl.innerHTML = '<strong>Shortfall: ' + formatCorpus(Math.abs(diff)) + ' below target</strong><span>Consider increasing SIP by 15%</span>';
        } else {
          gapEl.innerHTML = '<strong>✓ Meets Target</strong><span>Even with conservative returns</span>';
        }
      } else if (sc.id === 'baseline') {
        if (diff >= 0) {
          gapEl.innerHTML = '<strong>✓ On Track to Goal</strong><span>This assumes typical market performance</span>';
        } else {
          gapEl.innerHTML = '<strong>Shortfall: ' + formatCorpus(Math.abs(diff)) + '</strong><span>Consider adjusting parameters</span>';
        }
      } else {
        if (diff > 0) {
          gapEl.innerHTML = '<strong>Surplus: +' + formatCorpus(diff) + ' above target</strong><span>Extra cushion for legacy or extended travel</span>';
        } else {
          gapEl.innerHTML = '<strong>✓ Meets Target</strong><span>Optimistic scenario achieves goal</span>';
        }
      }
    });
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
      const acc = calcStepUpAccumulation(mid, annualReturn, years, stepUpRate);
      if (acc < targetCorpus) low = mid;
      else high = mid;
      if (Math.abs(high - low) < 1) break;
    }
    return Math.round((low + high) / 2);
  }

  // Accumulation with step-up
  function calcStepUpAccumulation(initialSIP, annualReturn, years, stepUpRate) {
    const monthlyReturn = annualReturn / 12;
    let total = 0;
    let sip = initialSIP;
    for (let y = 1; y <= years; y++) {
      // FV of 12 months of SIP invested this year
      const yearFV = sip * ((Math.pow(1 + monthlyReturn, 12) - 1) / monthlyReturn) * (1 + monthlyReturn);
      const yearsRemaining = years - y;
      total += yearFV * Math.pow(1 + annualReturn, yearsRemaining);
      sip = sip * (1 + stepUpRate);
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
      { rate: 0.06, color: '#ff9800', label: 'Conservative' },
      { rate: 0.12, color: '#224c87', label: 'Baseline' },
      { rate: 0.15, color: '#2e7d32', label: 'Optimistic' },
    ];

    // Compute data points for each scenario
    const allData = rates.map(sc => {
      const points = [];
      let total = 0;
      let sip = startingSIP;
      const monthlyReturn = sc.rate / 12;
      for (let y = 0; y <= years; y++) {
        points.push({ year: y, value: total });
        if (y < years) {
          const yearFV = sip * ((Math.pow(1 + monthlyReturn, 12) - 1) / monthlyReturn) * (1 + monthlyReturn);
          const yearsRemaining = years - y - 1;
          total += yearFV * Math.pow(1 + sc.rate, yearsRemaining);
          if (state.stepUpEnabled) sip = sip * (1 + state.annualRaise);
        }
      }
      // Recalculate properly: just track running total
      return points;
    });

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

    // Find max value
    let maxVal = 0;
    seriesData.forEach(s => s.points.forEach(p => { if (p.value > maxVal) maxVal = p.value; }));
    if (maxVal === 0) maxVal = 1;

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
    });
  }

  function formatCorpusShort(num) {
    if (num >= 10000000) return (num / 10000000).toFixed(1) + 'Cr';
    if (num >= 100000) return (num / 100000).toFixed(0) + 'L';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return Math.round(num).toString();
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
