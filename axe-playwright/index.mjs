#!/usr/bin/env node

import { chromium, firefox, webkit } from 'playwright';
import { injectAxe, checkA11y, getViolations, reportViolations } from 'axe-playwright';
import axeCore from 'axe-core';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class AccessibilityTester {
  constructor(options = {}) {
    this.url = options.url || 'https://playwright.dev/';
    this.outputDir = options.outputDir || path.join(process.cwd(), 'accessibility-reports');
    this.browser = options.browser || 'chromium';
    this.headed = options.headed || false;
    this.viewport = options.viewport || { width: 1920, height: 1080 };
    this.axeOptions = options.axeOptions || {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
      }
    };
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  async init() {
    const reportDir = path.join(this.outputDir, this.timestamp);
    await fs.mkdir(reportDir, { recursive: true });
    this.reportDir = reportDir;
    console.log(`\n📁 Report directory created: ${reportDir}`);
  }

  async launchBrowser() {
    const browserOptions = {
      headless: !this.headed,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };

    switch (this.browser.toLowerCase()) {
      case 'firefox':
        return await firefox.launch(browserOptions);
      case 'webkit':
      case 'safari':
        return await webkit.launch(browserOptions);
      default:
        return await chromium.launch(browserOptions);
    }
  }

  async runAudit() {
    console.log(`\n🔍 Starting accessibility audit`);
    console.log(`🌐 URL: ${this.url}`);
    console.log(`🖥️  Browser: ${this.browser}`);
    console.log(`📋 Rules: ${JSON.stringify(this.axeOptions.runOnly)}\n`);

    let browser;
    let context;
    let page;

    try {
      browser = await this.launchBrowser();
      context = await browser.newContext({
        viewport: this.viewport,
        ignoreHTTPSErrors: true
      });
      page = await context.newPage();

      console.log('🌐 Navigating to URL...');
      await page.goto(this.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      console.log('📸 Taking screenshot...');
      const screenshotPath = path.join(this.reportDir, 'screenshot.png');
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      console.log('🔧 Injecting axe-core...');
      await page.evaluate((axeSource) => {
        const script = document.createElement('script');
        script.textContent = axeSource;
        document.head.appendChild(script);
      }, axeCore.source);

      console.log('⚡ Running accessibility tests...');
      const results = await page.evaluate((options) => {
        return new Promise((resolve, reject) => {
          if (typeof window.axe === 'undefined') {
            reject(new Error('axe-core failed to load'));
            return;
          }

          window.axe.run(document, options)
            .then(results => resolve(results))
            .catch(error => reject(error));
        });
      }, this.axeOptions);

      await browser.close();
      return results;

    } catch (error) {
      if (browser) await browser.close();
      throw error;
    }
  }

  async runWithAxePlaywright() {
    console.log(`\n🔍 Starting accessibility audit with axe-playwright`);
    console.log(`🌐 URL: ${this.url}`);
    console.log(`🖥️  Browser: ${this.browser}\n`);

    let browser;
    let context;
    let page;

    try {
      browser = await this.launchBrowser();
      context = await browser.newContext({
        viewport: this.viewport,
        ignoreHTTPSErrors: true
      });
      page = await context.newPage();

      console.log('🌐 Navigating to URL...');
      await page.goto(this.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      console.log('📸 Taking screenshot...');
      const screenshotPath = path.join(this.reportDir, 'screenshot.png');
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      console.log('🔧 Injecting axe-core via axe-playwright...');
      await injectAxe(page);

      console.log('⚡ Checking accessibility...');
      const violations = await getViolations(page, null, this.axeOptions);

      // Run full axe analysis for complete results
      const results = await page.evaluate((options) => {
        return window.axe.run(document, options);
      }, this.axeOptions);

      await browser.close();
      return { ...results, violations };

    } catch (error) {
      if (browser) await browser.close();
      throw error;
    }
  }

  generateSummary(results) {
    const summary = {
      url: results.url,
      timestamp: results.timestamp,
      browser: this.browser,
      totalElements: results.passes.length + results.violations.length + results.incomplete.length + results.inapplicable.length,
      passes: results.passes.length,
      violations: results.violations.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
      violationsByImpact: {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0
      }
    };

    results.violations.forEach(violation => {
      if (violation.impact) {
        summary.violationsByImpact[violation.impact]++;
      }
    });

    return summary;
  }

  async generateJSONReport(results) {
    const jsonPath = path.join(this.reportDir, 'report.json');
    const report = {
      summary: this.generateSummary(results),
      results: results
    };

    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 JSON report saved: ${jsonPath}`);
    return report;
  }

  async generateHTMLReport(results) {
    const summary = this.generateSummary(results);
    const htmlPath = path.join(this.reportDir, 'report.html');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - ${new URL(this.url).hostname}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 0;
            margin-bottom: 30px;
            border-radius: 10px;
        }
        h1 {
            text-align: center;
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header-info {
            text-align: center;
            opacity: 0.9;
        }
        .browser-info {
            text-align: center;
            margin-top: 10px;
            font-size: 1.1em;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.3s;
        }
        .stat-card:hover {
            transform: translateY(-5px);
        }
        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .passes { color: #10b981; }
        .violations { color: #ef4444; }
        .incomplete { color: #f59e0b; }
        .inapplicable { color: #6b7280; }
        .impact-summary {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .impact-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .impact-item {
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            font-weight: bold;
        }
        .critical { background: #fee2e2; color: #991b1b; }
        .serious { background: #fed7aa; color: #c2410c; }
        .moderate { background: #fef3c7; color: #d97706; }
        .minor { background: #dbeafe; color: #1e40af; }
        .violations-section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .violation {
            border-left: 4px solid #ef4444;
            padding: 20px;
            margin: 20px 0;
            background: #fef2f2;
            border-radius: 0 8px 8px 0;
        }
        .violation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .violation-title {
            font-size: 1.2em;
            font-weight: bold;
            color: #1f2937;
        }
        .violation-impact {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .violation-description {
            color: #4b5563;
            margin-bottom: 15px;
            line-height: 1.6;
        }
        .violation-details {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
        }
        .affected-elements {
            background: white;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            overflow-x: auto;
        }
        .help-link {
            display: inline-block;
            margin-top: 10px;
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
        }
        .help-link:hover {
            text-decoration: underline;
        }
        .screenshot-section {
            margin-top: 40px;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .screenshot-img {
            width: 100%;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #6b7280;
        }
        .test-info {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .test-info-item {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }
        .test-info-label {
            font-weight: bold;
            color: #4b5563;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Accessibility Report</h1>
            <div class="header-info">
                <p>${new URL(this.url).hostname}</p>
                <p>${new Date(summary.timestamp).toLocaleString()}</p>
                <div class="browser-info">
                    🖥️ Browser: ${this.browser.charAt(0).toUpperCase() + this.browser.slice(1)}
                </div>
            </div>
        </header>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-number passes">${summary.passes}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number violations">${summary.violations}</div>
                <div class="stat-label">Violations</div>
            </div>
            <div class="stat-card">
                <div class="stat-number incomplete">${summary.incomplete}</div>
                <div class="stat-label">Incomplete</div>
            </div>
            <div class="stat-card">
                <div class="stat-number inapplicable">${summary.inapplicable}</div>
                <div class="stat-label">Not Applicable</div>
            </div>
        </div>

        ${summary.violations > 0 ? `
        <div class="impact-summary">
            <h2>Violations by Impact Level</h2>
            <div class="impact-grid">
                <div class="impact-item critical">
                    Critical: ${summary.violationsByImpact.critical}
                </div>
                <div class="impact-item serious">
                    Serious: ${summary.violationsByImpact.serious}
                </div>
                <div class="impact-item moderate">
                    Moderate: ${summary.violationsByImpact.moderate}
                </div>
                <div class="impact-item minor">
                    Minor: ${summary.violationsByImpact.minor}
                </div>
            </div>
        </div>

        <div class="violations-section">
            <h2>Violation Details</h2>
            ${results.violations.map(violation => `
                <div class="violation">
                    <div class="violation-header">
                        <div class="violation-title">${violation.help}</div>
                        <span class="violation-impact ${violation.impact}">${violation.impact}</span>
                    </div>
                    <div class="violation-description">
                        ${violation.description}
                    </div>
                    <div class="violation-details">
                        <strong>Rule ID:</strong> ${violation.id}<br>
                        <strong>WCAG:</strong> ${violation.tags.join(", ")}<br>
                        <strong>Elements Affected:</strong> ${violation.nodes.length}
                        ${violation.nodes.length > 0 ? `
                            <div class="affected-elements">
                                ${violation.nodes.slice(0, 3).map(node => node.target.join(" ")).join("<br>")}
                                ${violation.nodes.length > 3 ? `<br>... and ${violation.nodes.length - 3} more` : ""}
                            </div>
                        ` : ""}
                        <a href="${violation.helpUrl}" target="_blank" class="help-link">
                            Learn more about this issue →
                        </a>
                    </div>
                </div>
            `).join("")}
        </div>
        ` : `
        <div class="impact-summary">
            <h2 style="color: #10b981; text-align: center;">✅ No accessibility violations found!</h2>
        </div>
        `}

        <div class="test-info">
            <h3>Test Configuration</h3>
            <div class="test-info-item">
                <span class="test-info-label">Test Engine:</span>
                <span>axe-core ${axeCore.version}</span>
            </div>
            <div class="test-info-item">
                <span class="test-info-label">Test Framework:</span>
                <span>Playwright with axe-playwright</span>
            </div>
            <div class="test-info-item">
                <span class="test-info-label">Browser:</span>
                <span>${this.browser}</span>
            </div>
            <div class="test-info-item">
                <span class="test-info-label">Viewport:</span>
                <span>${this.viewport.width} x ${this.viewport.height}</span>
            </div>
            <div class="test-info-item">
                <span class="test-info-label">Rules Applied:</span>
                <span>${this.axeOptions.runOnly?.values?.join(", ") || "All"}</span>
            </div>
        </div>

        <div class="screenshot-section">
            <h2>Page Screenshot</h2>
            <img src="screenshot.png" alt="Screenshot of tested page" class="screenshot-img">
        </div>

        <footer>
            <p>Generated with axe-core ${axeCore.version} and Playwright</p>
        </footer>
    </div>
</body>
</html>`;

    await fs.writeFile(htmlPath, html);
    console.log(`🌐 HTML report saved: ${htmlPath}`);
  }

  printConsoleSummary(summary) {
    console.log("\n" + "=".repeat(60));
    console.log("📊 ACCESSIBILITY AUDIT SUMMARY");
    console.log("=".repeat(60));
    console.log(`🔗 URL: ${summary.url}`);
    console.log(`🖥️  Browser: ${summary.browser}`);
    console.log(`📅 Tested: ${new Date(summary.timestamp).toLocaleString()}`);
    console.log(`📦 Total Elements Tested: ${summary.totalElements}`);
    console.log("-".repeat(60));

    console.log(`✅ Passed: ${summary.passes}`);
    console.log(`❌ Violations: ${summary.violations}`);
    console.log(`⚠️  Incomplete: ${summary.incomplete}`);
    console.log(`➖ Not Applicable: ${summary.inapplicable}`);

    if (summary.violations > 0) {
      console.log("-".repeat(60));
      console.log("🎯 Violations by Impact:");
      console.log(`   🔴 Critical: ${summary.violationsByImpact.critical}`);
      console.log(`   🟠 Serious: ${summary.violationsByImpact.serious}`);
      console.log(`   🟡 Moderate: ${summary.violationsByImpact.moderate}`);
      console.log(`   🔵 Minor: ${summary.violationsByImpact.minor}`);
    }

    console.log("=".repeat(60));
  }

  async runMultipleBrowsers(browsers = ['chromium', 'firefox', 'webkit']) {
    const results = {};

    for (const browser of browsers) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🖥️  Testing with ${browser.toUpperCase()}`);
      console.log("=".repeat(60));

      this.browser = browser;
      this.timestamp = `${browser}-${new Date().toISOString().replace(/[:.]/g, '-')}`;

      try {
        await this.init();
        const auditResults = await this.runWithAxePlaywright();
        const report = await this.generateJSONReport(auditResults);
        await this.generateHTMLReport(auditResults);
        this.printConsoleSummary(report.summary);

        results[browser] = {
          success: true,
          summary: report.summary,
          reportDir: this.reportDir
        };
      } catch (error) {
        console.error(`❌ Failed to test with ${browser}:`, error.message);
        results[browser] = {
          success: false,
          error: error.message
        };
      }
    }

    return results;
  }

  async run() {
    try {
      await this.init();
      const results = await this.runWithAxePlaywright();

      const report = await this.generateJSONReport(results);
      await this.generateHTMLReport(results);

      this.printConsoleSummary(report.summary);

      console.log(`\n✨ Accessibility audit completed successfully!`);
      console.log(`📁 Reports saved in: ${this.reportDir}\n`);

      return report;
    } catch (error) {
      console.error("\n❌ Audit failed:", error.message);
      throw error;
    }
  }
}

async function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    outputDir: null,
    browser: 'chromium',
    headed: false,
    allBrowsers: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
      case '-u':
        options.url = args[++i];
        break;
      case '--output':
      case '-o':
        options.outputDir = args[++i];
        break;
      case '--browser':
      case '-b':
        options.browser = args[++i];
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--all-browsers':
        options.allBrowsers = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  if (options.help) {
    console.log(`
Accessibility Testing with Playwright and axe-core
==================================================

Usage: node index.mjs [options]

Options:
  --url, -u <url>         URL to test (default: https://playwright.dev/)
  --output, -o <dir>      Output directory (default: ./accessibility-reports)
  --browser, -b <name>    Browser to use: chromium, firefox, webkit (default: chromium)
  --headed                Run browser in headed mode (default: headless)
  --all-browsers          Run tests in all browsers (chromium, firefox, webkit)
  --help, -h              Show this help message

Examples:
  node index.mjs --url https://example.com
  node index.mjs -u https://example.com -b firefox --headed
  node index.mjs --all-browsers
  node index.mjs --url https://example.com --output ./reports
    `);
    process.exit(0);
  }

  return options;
}

(async () => {
  const options = await parseArgs();
  const tester = new AccessibilityTester(options);

  if (options.allBrowsers) {
    const results = await tester.runMultipleBrowsers();

    console.log(`\n${"=".repeat(60)}`);
    console.log("📊 MULTI-BROWSER TEST SUMMARY");
    console.log("=".repeat(60));

    for (const [browser, result] of Object.entries(results)) {
      if (result.success) {
        console.log(`✅ ${browser}: ${result.summary.violations} violations found`);
        console.log(`   📁 Report: ${result.reportDir}`);
      } else {
        console.log(`❌ ${browser}: Failed - ${result.error}`);
      }
    }
    console.log("=".repeat(60));
  } else {
    await tester.run();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});