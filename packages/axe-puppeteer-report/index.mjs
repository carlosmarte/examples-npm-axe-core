if (/jenkins/.test(process.env.PLATFORM)) {
  process.env.GLOBAL_AGENT_HTTP_PROXY = "";
  process.env.GLOBAL_AGENT_HTTPS_PROXY = "";
  process.env.GLOBAL_AGENT_NO_PROXY = "";
}

import "global-agent/bootstrap.js";
import SauceLabs from "saucelabs";
import AbortController from "abort-controller";
import fetch from "node-fetch";
import path from "path";
import puppeteer from "puppeteer";
import mkdirp from "mkdirp";
import axeCore from "axe-core";
import jsonfile from "jsonfile";

const RUN_ON_SAUCELABS = false;

(async () => {
  const puppeteerArgs = [];

  if (process.env.PROXY_HTTP)
    puppeteerArgs.push(`--proxy-server=${process.env.PROXY_HTTP}`);

  mkdirp.sync(path.join(process.cwd(), ".tmp"));
  mkdirp.sync(path.join(process.cwd(), ".tmp/ChromeSession"));

  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSError: true,
    executablePath: "/Applications/Chromium.app/Contents/MacOS/Chromium",
    userDataDir: path.join(process.cwd(), ".tmp/ChromeSession"),
    handleSIGINT: false,
    args: [].concat(puppeteerArgs),
  });

  const screenshotSaveToPath = path.join(process.cwd(), ".tmp/testing.png");

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto("https://webdriver.io/", {
    waitUntil: "networkidle0",
    timeout: 0,
  });

  await page.addScriptTag({
    content: axeCore.source,
  });

  const axeCoreConfig = {
    run: ["wcag2a"],
  };

  const [axeCoreError, entry] = await page.evaluate(function (axeCoreConfig) {
    if (typeof window.axe === "undefined" || typeof axe.run !== "function") {
      return [new Error("axe-core is missing")];
    }

    const context = window.document;
    return axe
      .run(context, axeCoreConfig)
      .then(function (entry) {
        return [null, entry];
      })
      .catch(function (error) {
        return [error];
      });
  }, axeCoreConfig);

  if (axeCoreError) throw axeCoreError;

  const axeCoreSaveToPath = path.join(process.cwd(), ".tmp/testing.json");

  await jsonfile.writeFileSync(axeCoreSaveToPath, entry, {
    spaces: 2,
  });

  await page.screenshot({ path: screenshotSaveToPath, fullPage: true });

  await browser.close();
})().catch(async (e) => {
  console.error(e);
});
