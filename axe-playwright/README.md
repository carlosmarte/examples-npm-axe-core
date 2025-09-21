# axe-playwright

Accessibility testing integration combining the power of Playwright browser automation with axe-core accessibility engine.

## Features

- 🎭 **Multi-browser support**: Test with Chromium, Firefox, and WebKit
- 📊 **Comprehensive reports**: Generate JSON and HTML reports with detailed violation information
- 📸 **Visual documentation**: Automatic screenshots of tested pages
- 🎯 **WCAG compliance**: Test against WCAG 2.0, 2.1, Section 508, and best practices
- 🚀 **Easy to use**: Simple CLI with sensible defaults
- 🔍 **Detailed analysis**: Impact levels, affected elements, and actionable remediation guidance

## Installation

```bash
npm install
```

## Usage

### Basic usage

```bash
# Test the default URL (https://playwright.dev/)
node index.mjs

# Test a specific URL
node index.mjs --url https://example.com

# Test with a specific browser
node index.mjs --browser firefox --url https://example.com

# Run in headed mode to see the browser
node index.mjs --headed --url https://example.com

# Test with all browsers
node index.mjs --all-browsers --url https://example.com
```

### Command Line Options

- `--url, -u <url>` - URL to test (default: https://playwright.dev/)
- `--output, -o <dir>` - Output directory for reports (default: ./accessibility-reports)
- `--browser, -b <name>` - Browser to use: chromium, firefox, or webkit (default: chromium)
- `--headed` - Run browser in headed mode instead of headless
- `--all-browsers` - Run tests in all available browsers
- `--help, -h` - Show help message

### Programmatic Usage

```javascript
import { AccessibilityTester } from './index.mjs';

const tester = new AccessibilityTester({
  url: 'https://example.com',
  browser: 'chromium',
  outputDir: './reports',
  headed: false,
  axeOptions: {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa']
    }
  }
});

const report = await tester.run();
console.log(report.summary);
```

### Multi-Browser Testing

```javascript
const tester = new AccessibilityTester({
  url: 'https://example.com'
});

const results = await tester.runMultipleBrowsers(['chromium', 'firefox', 'webkit']);

for (const [browser, result] of Object.entries(results)) {
  console.log(`${browser}: ${result.summary.violations} violations`);
}
```

## Reports

The tool generates two types of reports:

### HTML Report
- Visual summary with charts and statistics
- Detailed violation information with impact levels
- Affected elements with CSS selectors
- Links to axe-core documentation for remediation
- Full-page screenshot of the tested page

### JSON Report
- Complete axe-core results
- Summary statistics
- Machine-readable format for CI/CD integration

## Axe-Core Rules

By default, the tool tests against:
- WCAG 2.0 Level A & AA
- WCAG 2.1 Level A & AA
- Section 508
- Best practices

You can customize the rules by modifying the `axeOptions` configuration.

## Example Output

```
📊 ACCESSIBILITY AUDIT SUMMARY
============================================================
🔗 URL: https://playwright.dev
🖥️  Browser: chromium
📅 Tested: 1/15/2024, 10:30:00 AM
📦 Total Elements Tested: 1250
------------------------------------------------------------
✅ Passed: 1240
❌ Violations: 5
⚠️  Incomplete: 3
➖ Not Applicable: 2
------------------------------------------------------------
🎯 Violations by Impact:
   🔴 Critical: 0
   🟠 Serious: 2
   🟡 Moderate: 2
   🔵 Minor: 1
============================================================
```

## Integration with CI/CD

```bash
# Exit with error code if violations found
node index.mjs --url https://example.com || exit 1
```

## License

MIT