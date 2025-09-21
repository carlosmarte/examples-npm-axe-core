import { remote } from 'webdriverio';
import AxeBuilder from '@axe-core/webdriverio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runAccessibilityTest() {
  let browser;

  try {
    console.log('Starting WebdriverIO browser...');

    browser = await remote({
      logLevel: 'error',
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
        }
      }
    });

    const testUrl = 'https://www.deque.com/axe/core-documentation/';
    console.log(`Navigating to ${testUrl}...`);
    await browser.url(testUrl);

    console.log('Running axe-core accessibility tests...');
    const axeBuilder = new AxeBuilder({ client: browser });

    const results = await axeBuilder
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    console.log('\n=== Accessibility Test Results ===');
    console.log(`URL: ${results.url}`);
    console.log(`Timestamp: ${results.timestamp}`);
    console.log(`\nViolations found: ${results.violations.length}`);
    console.log(`Passes: ${results.passes.length}`);
    console.log(`Incomplete: ${results.incomplete.length}`);
    console.log(`Inapplicable: ${results.inapplicable.length}`);

    if (results.violations.length > 0) {
      console.log('\n=== Violations Summary ===');
      results.violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. ${violation.description}`);
        console.log(`   ID: ${violation.id}`);
        console.log(`   Impact: ${violation.impact}`);
        console.log(`   Help: ${violation.help}`);
        console.log(`   Help URL: ${violation.helpUrl}`);
        console.log(`   Affected elements: ${violation.nodes.length}`);

        if (violation.nodes.length > 0 && violation.nodes[0].html) {
          console.log(`   Example: ${violation.nodes[0].html.substring(0, 100)}...`);
        }
      });
    } else {
      console.log('\n✓ No accessibility violations found!');
    }

    const reportDir = path.join(__dirname, 'reports');
    await fs.mkdir(reportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `accessibility-report-${timestamp}.json`);

    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n✓ Full report saved to: ${reportPath}`);

    const htmlReportPath = path.join(reportDir, `accessibility-report-${timestamp}.html`);
    const htmlReport = generateHTMLReport(results);
    await fs.writeFile(htmlReportPath, htmlReport);
    console.log(`✓ HTML report saved to: ${htmlReportPath}`);

  } catch (error) {
    console.error('Error running accessibility tests:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.deleteSession();
      console.log('\nBrowser session closed.');
    }
  }
}

function generateHTMLReport(results) {
  const violationRows = results.violations.map(v => `
    <tr>
      <td>${v.id}</td>
      <td>${v.description}</td>
      <td><span class="impact impact-${v.impact}">${v.impact}</span></td>
      <td>${v.nodes.length}</td>
      <td><a href="${v.helpUrl}" target="_blank">Help</a></td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - ${new Date().toLocaleString()}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 {
            color: #2c3e50;
            margin: 0 0 10px 0;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .summary-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-card h3 {
            margin: 0 0 5px 0;
            font-size: 14px;
            color: #666;
        }
        .summary-card .count {
            font-size: 28px;
            font-weight: bold;
        }
        .violations { color: #e74c3c; }
        .passes { color: #27ae60; }
        .incomplete { color: #f39c12; }
        .inapplicable { color: #95a5a6; }
        table {
            width: 100%;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
            margin-top: 20px;
        }
        th {
            background: #2c3e50;
            color: white;
            padding: 12px;
            text-align: left;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
        }
        tr:last-child td {
            border-bottom: none;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .impact {
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .impact-critical { background: #e74c3c; color: white; }
        .impact-serious { background: #e67e22; color: white; }
        .impact-moderate { background: #f39c12; color: white; }
        .impact-minor { background: #95a5a6; color: white; }
        .metadata {
            color: #666;
            font-size: 14px;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Accessibility Test Report</h1>
        <div class="metadata">
            <p><strong>URL:</strong> ${results.url}</p>
            <p><strong>Tested on:</strong> ${new Date(results.timestamp).toLocaleString()}</p>
            <p><strong>Test Engine:</strong> axe-core ${results.testEngine.version}</p>
        </div>
    </div>

    <div class="summary">
        <div class="summary-card">
            <h3>Violations</h3>
            <div class="count violations">${results.violations.length}</div>
        </div>
        <div class="summary-card">
            <h3>Passes</h3>
            <div class="count passes">${results.passes.length}</div>
        </div>
        <div class="summary-card">
            <h3>Incomplete</h3>
            <div class="count incomplete">${results.incomplete.length}</div>
        </div>
        <div class="summary-card">
            <h3>Inapplicable</h3>
            <div class="count inapplicable">${results.inapplicable.length}</div>
        </div>
    </div>

    ${results.violations.length > 0 ? `
        <h2>Violations</h2>
        <table>
            <thead>
                <tr>
                    <th>Rule ID</th>
                    <th>Description</th>
                    <th>Impact</th>
                    <th>Elements</th>
                    <th>Help</th>
                </tr>
            </thead>
            <tbody>
                ${violationRows}
            </tbody>
        </table>
    ` : '<h2>✓ No Violations Found</h2>'}
</body>
</html>`;
}

runAccessibilityTest().catch(console.error);