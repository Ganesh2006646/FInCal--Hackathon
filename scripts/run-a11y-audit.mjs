import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ARTIFACT_DIR = path.join(process.cwd(), 'artifacts', 'a11y');

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // ignore until timeout
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms.`);
}

function startServer() {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', `npm run start -- -p ${PORT}`], {
      cwd: process.cwd(),
      stdio: 'inherit',
      windowsHide: true,
    });
  }

  return spawn('npm', ['run', 'start', '--', '-p', String(PORT)], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}

async function runAxeAudits() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const checks = [
    { name: 'landing', action: async () => page.evaluate(() => window.goToStep?.(0)) },
    { name: 'step-1', action: async () => page.evaluate(() => window.goToStep?.(1)) },
    { name: 'step-2', action: async () => page.evaluate(() => window.goToStep?.(2)) },
    { name: 'step-3', action: async () => page.evaluate(() => window.goToStep?.(3)) },
    { name: 'step-4', action: async () => page.evaluate(() => window.goToStep?.(4)) },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    tool: 'axe-core via @axe-core/playwright',
    url: BASE_URL,
    pages: [],
    violationCount: 0,
  };

  for (const check of checks) {
    await check.action();
    await page.waitForTimeout(250);

    const results = await new AxeBuilder({ page }).analyze();
    report.pages.push({
      name: check.name,
      violations: results.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodeCount: v.nodes.length,
      })),
      violationCount: results.violations.length,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
    });
    report.violationCount += results.violations.length;
  }

  await context.close();
  await browser.close();
  return report;
}

async function runLighthouseAudit() {
  const chrome = await launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  });

  try {
    const result = await lighthouse(BASE_URL, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['accessibility'],
      throttlingMethod: 'provided',
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
    });

    if (!result || !result.lhr) {
      throw new Error('Lighthouse returned no report output.');
    }

    return {
      generatedAt: new Date().toISOString(),
      tool: 'Lighthouse',
      url: BASE_URL,
      score: result.lhr.categories.accessibility.score,
      audits: result.lhr.audits,
    };
  } finally {
    await chrome.kill();
  }
}

function buildSummary(axeReport, lighthouseReport) {
  const lines = [];
  lines.push(`Accessibility Evidence Summary`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Target URL: ${BASE_URL}`);
  lines.push('');
  lines.push('Automated Audit Results');
  lines.push(`- Axe total violations: ${axeReport.violationCount}`);
  for (const page of axeReport.pages) {
    lines.push(`- Axe ${page.name}: ${page.violationCount} violation(s)`);
  }
  lines.push(`- Lighthouse accessibility score: ${Math.round((lighthouseReport.score ?? 0) * 100)}/100`);
  lines.push('');
  lines.push('Manual Verification Required for Final Certification');
  lines.push('- Screen reader walkthrough (NVDA/JAWS/VoiceOver)');
  lines.push('- Keyboard-only walkthrough across all steps and modal states');
  lines.push('- Contrast validation for normal text, large text, icons, and focus states');
  lines.push('- Mobile/tablet touch target and orientation checks');
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const server = startServer();

  try {
    await waitForServer(BASE_URL);

    const axeReport = await runAxeAudits();
    await writeFile(path.join(ARTIFACT_DIR, 'axe-report.json'), JSON.stringify(axeReport, null, 2), 'utf8');

    const lighthouseReport = await runLighthouseAudit();
    await writeFile(path.join(ARTIFACT_DIR, 'lighthouse-accessibility.json'), JSON.stringify(lighthouseReport, null, 2), 'utf8');

    const summary = buildSummary(axeReport, lighthouseReport);
    await writeFile(path.join(ARTIFACT_DIR, 'accessibility-summary.txt'), summary, 'utf8');

    console.log('Accessibility audit complete. Reports saved in artifacts/a11y/.');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
