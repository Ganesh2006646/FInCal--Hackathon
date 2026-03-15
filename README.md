# 🏆 Life-Proof Retirement Calculator
**Team Design Dynamos | FinCal Innovation Hackathon 2025 | HDFC Mutual Fund**

[![Next.js](https://img.shields.io/badge/Next.js-15.5.9-black?logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.11.x-green?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![WCAG](https://img.shields.io/badge/Accessibility-WCAG_2.1_AA-purple.svg)](#-accessibility--ux-excellence)

> Standard retirement calculators demand a terrifying ₹26,000/month SIP from day one. We help young investors start with an achievable **₹8,500/month** — growing realistically alongside their careers.

## 🎯 The Problem: Why Current Calculators Fail
Industry-standard retirement tools are mathematically sound but psychologically flawed. They suffer from three critical blind spots:

1. **The "Sandwich Generation" Crisis:** 68% of Indian millennials financially support aging parents, yet calculators ignore the **12–14% medical inflation** rate, defaulting to a flat 6% lifestyle inflation.
2. **The "Sticker Shock" Drop-off:** Asking a 25-year-old to invest ₹25,000/month immediately causes funnel abandonment.
3. **Static & Unrelatable:** Outputting a massive required corpus without explaining the everyday trade-offs leaves users confused and unmotivated.

## 💡 Our Solution: The "Life-Proof" Approach
We engineered an empathetic, interactive financial engine that replaces panic with actionable strategy.

| Core Feature | Technical Implementation & User Benefit |
|--------------|-----------------------------------------|
| **Dual-Track Inflation Engine** | Separates standard living expenses (6% inflation) from healthcare/dependent costs (14% inflation) for pinpoint accuracy. |
| **Step-Up SIP Algorithm** | Calculates an achievable starting SIP that grows annually (e.g., 10%) to mirror real-world salary progression. |
| **Geo-Arbitrage Modeling** | Instantly recalculates the required corpus based on retirement destination (Metro vs. Tier-2 vs. Hometown). |
| **Smart Narrative AI** | A typewriter-animated engine that translates complex numeric outputs into a personalized, human-readable summary. |
| **Relativity Translator** | Contextualizes SIP increases (e.g., *"Adding ₹1,000/mo is skipping 3 coffees, but adds ₹35 Lakhs to your corpus"*). |
| **Shareable URL State** | Encodes the user's entire financial scenario into the URL (`?age=28&retire=60...`) for instant, serverless sharing. |

---

## 🏗️ Technical Architecture & Tech Stack
The application is strictly engineered to meet HDFC's enterprise compliance mandates while delivering a 60fps, zero-latency user experience.

- **Frontend Framework:** Next.js 15.5.9 (App Router)
- **Runtime Environment:** Node.js 22.11.x
- **Data Visualization:** High-performance, native HTML5 `<canvas>` API (Zero external charting libraries)
- **Data Privacy:** 100% Stateless client architecture (Zero PII captured)
- **Analytics Backend:** Optional MySQL 8.0 schema provided for enterprise macro-trend tracking.

### The React-to-Native Bridge (`CalculatorExperience.jsx`)
To ensure maximum performance and seamless integration of our custom financial algorithms, the calculator engine utilizes a highly optimized native web rendering approach, mounted securely within a Next.js Client Component bridge using safely parsed DOM injection.

---

## 📐 Mathematical Engine (The "Brain")
Our codebase utilizes mathematically correct, industry-standard financial formulas, dynamically calculating thousands of data points instantly.

### 1. Future Expense Calculation (Dual-Track)
```text
Standard Portion = Expense × (1 - Healthcare_Ratio) × (1 + 0.06)^years
Healthcare Portion = Expense × Healthcare_Ratio × (1 + 0.14)^years
```

### 2. Required Retirement Corpus (PV of Annuity)
```text
Corpus = Future_Annual_Expense × [(1 - (1 + Post_Retirement_Return)^-Retirement_Duration) / Post_Retirement_Return]
```

### 3. Step-Up SIP (Binary Search Algorithm)
Rather than relying on rough estimates, our engine utilizes a custom 100-iteration Binary Search algorithm to programmatically solve for the exact starting Step-Up SIP amount required to hit the target corpus, ensuring decimal-level accuracy.

---

## ♿ Accessibility & UX Excellence (WCAG 2.1 AA)
We believe financial literacy must be accessible to everyone. The UI/UX was designed from the ground up for inclusivity:

- **Screen Reader Optimization:** Extensive use of `aria-live="polite"`, `role="radiogroup"`, and dynamic `aria-invalid` error states.
- **Keyboard Power-Users:** Full Tab navigation, `Ctrl+Enter` global calculation shortcut, and numeric keys 1-4 for instant section jumping.
- **Responsive Design:** 44px minimum touch targets and adaptive layout scaling from 4K desktop monitors down to 320px mobile screens.
- **Motion Accessibility:** Follows `prefers-reduced-motion` OS settings to gracefully disable the typewriter narrative and canvas animations for sensitive users.

## ✅ HDFC Hackathon Compliance Matrix

| Mandatory Requirement | Status | Implementation Evidence |
|-----------------------|--------|-------------------------|
| Category Selection | PASS | Strictly built as a "Retirement Planning Calculator". |
| Next.js 15.5.9 Compatibility | PASS | Explicitly defined in `package.json` dependencies. |
| Editable Assumptions | PASS | Post-retirement return, medical inflation, timeline, and pre-retirement returns are 100% user-editable via the Dashboard What-If controls. |
| No "Growth" Metaphors | PASS | Scrubbed of gamification; uses neutral SVG iconography (umbrellas, shields) per strict brand guidelines. |
| Mandatory Disclaimer | PASS | Hardcoded, non-dismissible HDFC legal disclaimer integrated into a sticky footer overlay. |
| MySQL Compatibility | PASS | Included `database/schema.sql` demonstrating the enterprise pipeline for anonymized usage analytics. |

## 🚀 Quick Start (Local Development)

### 1. Clone the repository
```bash
git clone https://github.com/Ganesh2006646/FInCal--Hackathon.git
cd FInCal--Hackathon
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the Next.js development server
```bash
npm run dev
```

Navigate to `http://localhost:3000` to view the application.

## 🗄️ Enterprise Database Installation (MySQL)
To strictly adhere to the "Purely Anonymous" mandate, the live frontend stores no data. However, for HDFC's internal deployment, we have provided an analytics schema to track demographic trends (e.g., Geo-Arbitrage choices).

To verify the schema locally:

```bash
mysql -u root -p
source database/schema.sql;
USE hdfc_fincal_analytics;
SHOW TABLES;
DESCRIBE anonymous_calculator_sessions;
```

## 💼 Business Value for HDFC Mutual Fund

- **Lead Qualification:** Identifying users planning to retire in "Tier-2" vs "Metros" allows HDFC to segment localized marketing campaigns without requiring invasive PII.
- **Higher Funnel Conversion:** Replacing the traditional ₹26k/mo requirement with an ₹8.5k/mo Step-Up plan dramatically reduces bounce rates on the calculator page.
- **Decoupled Architecture:** The separation of the core mathematical engine from the Next.js wrapper makes it trivial for HDFC's engineering teams to localize the UI into Hindi, Tamil, or Telugu.

## 👥 Team: Design Dynamos
- **Ganesh** — Calculation Engine & Frontend Architecture
- **Rishit** — Next.js Integration & UI/UX Design
- **Aditya** — Data Modeling & Compliance Formatting
