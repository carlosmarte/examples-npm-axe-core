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
import { remote } from "webdriverio";

const RUN_ON_SAUCELABS = false;

(async () => {
  const saucelabs = new SauceLabs.default({
    logfile: path.join(process.cwd(), "saucelabs.log"),
  });

  const controller = new AbortController();

  const saucelabsResponse = await fetch(saucelabs.webdriverEndpoint, {
    signal: controller.signal,
  });

  console.log(`saucelabs response: ${saucelabsResponse.ok}`);

  if (!saucelabsResponse.ok)
    throw new Error("error with saucelabs connections");

  await controller.abort();

  const webdriverSettings = {
    logLevel: "error",
    capabilities: {
      browserName: "chrome",
      browserVersion: "latest",
      platformName: "macOS 12",
    },
  };

  if (RUN_ON_SAUCELABS)
    webdriverSettings.capabilities["sauce:options"] = {
      region: "us",
      name: "testing",
      "custom-data": {},
      public: "public",
      recordScreenshots: true,
      screenResolution: "2048x1536",
      extendedDebugging: false,
      capturePerformance: false,
    };

  if (RUN_ON_SAUCELABS)
    Object.assign(webdriverSettings, {
      user: process.env.SAUCE_USERNAME,
      key: process.env.SAUCE_ACCESS_KEY,
    });

  const browser = await remote(webdriverSettings);

  await browser.url("https://webdriver.io/");
  const pageTitle = await browser.getTitle();
  const sessionId = browser.sessionId;

  console.log(`${pageTitle}: https://app.saucelabs.com/tests/${sessionId}`);

  await browser.deleteSession();
})().catch(async (e) => {
  console.error(e);
});
