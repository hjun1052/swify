const puppeteer = require('puppeteer');

async function scrapeWeb(query) {
  console.log(`Testing scrape for: ${query}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    // Modern UA
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // --- STRATEGY 1: GOOGLE ---
    console.log("Strategy 1: Google...");
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us`; // gl=us for consistent English results
    await page.goto(googleUrl, { waitUntil: "domcontentloaded" });

    try {
      await page.waitForSelector('div.g', { timeout: 5000 });
      const googleRes = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.VwiC3b').forEach(el => {
          if (el.textContent) results.push(el.textContent);
        });
        return results;
      });
      console.log(`Google Results (${googleRes.length}):`, googleRes.slice(0, 2));
    } catch (e) {
      console.log("Google failed or timed out waiting for selector.");
    }

    // --- STRATEGY 2: DUCKDUCKGO (Fallback) ---
    console.log("\nStrategy 2: DuckDuckGo...");
    // html.duckduckgo.com/html is the lightweight version, very easy to scrape
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    await page.goto(ddgUrl, { waitUntil: "domcontentloaded" });

    const ddgRes = await page.evaluate(() => {
      const results = [];
      // DDG HTML version uses .result__snippet
      document.querySelectorAll('.result__snippet').forEach(el => {
        if (el.textContent) results.push(el.textContent);
      });
      return results;
    });

    console.log(`DDG Results (${ddgRes.length}):`, ddgRes.slice(0, 2));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
}

scrapeWeb("latest artificial intelligence news 2025");
