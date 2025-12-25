const puppeteer = require('puppeteer');

// Mocking the getBrowser internal logic for the standalone script
async function getBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

async function scrapeWeb(query) {
  console.log(`[Start] Scraping: ${query}`);
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    // Block heavy assets
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "stylesheet", "font", "media"].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // --- STRATEGY: DUCKDUCKGO ONLY ---
    try {
      await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { waitUntil: "domcontentloaded", timeout: 15000 });

      const results = await page.evaluate(() => {
        const els = document.querySelectorAll(".result__snippet");
        const res = [];
        els.forEach(el => { if (el.textContent) res.push(el.textContent); });
        return res.slice(0, 10);
      });

      console.log(`[Success] ${query} -> Found ${results.length} snippets`);
      return results;

    } catch (e) {
      console.log(`[Fail] ${query} -> ${e.message}`);
      return [];
    }

  } finally {
    await browser.close();
  }
}

async function runParallel() {
  console.time("DeepSearch");
  const queries = [
    "Latest AI News December 2025",
    "Artificial Intelligence Regulation 2025",
    "New AI Models Q4 2025"
  ];

  const results = await Promise.all(queries.map(q => scrapeWeb(q)));

  const allSnippets = results.flat();
  console.timeEnd("DeepSearch");
  console.log(`Total Deduplicated Snippets: ${new Set(allSnippets).size}`);
  console.log("Snippet Samples:", allSnippets.slice(0, 3));
}

runParallel();
