import puppeteer from "puppeteer";

// Helper to launch browser consistently
async function getBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

// Helper to extract text from a page
async function extractPageText(browser: any, url: string) {
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setRequestInterception(true);
    page.on("request", (req: any) => {
      if (
        ["image", "stylesheet", "font", "media", "script"].includes(
          req.resourceType()
        )
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(`[Crawler] Visiting: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 }); // strict timeout

    const text = await page.evaluate(() => {
      const paragraphs = Array.from(document.querySelectorAll("p"));
      // Filter out short cookie warnings etc
      return paragraphs
        .map((p) => p.innerText.trim())
        .filter((t) => t.length > 50)
        .slice(0, 15) // Take first 15 meaningful paragraphs
        .join("\n\n");
    });

    return `SOURCE: ${url}\n${text}`;
  } catch (e) {
    console.error(`[Crawler] Failed to visit ${url}`, e);
    return "";
  } finally {
    if (page) await page.close();
  }
}

export async function scrapeWeb(query: string) {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Block assets for search page
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "stylesheet", "font", "media"].includes(req.resourceType()))
        req.abort();
      else req.continue();
    });

    // 1. Search DDG
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      query
    )}`;
    console.log(`[Crawler] Searching: ${query}`);
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    // 2. Extract Top Results (Title + URL)
    const results = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll(".result__body"))
        .map((el: any) => {
          const titleEl = el.querySelector(".result__a");
          const snippetEl = el.querySelector(".result__snippet");
          return {
            title: titleEl ? titleEl.innerText : "",
            href: titleEl ? titleEl.href : "",
            snippet: snippetEl ? snippetEl.innerText : "",
          };
        })
        .filter((item) => {
          if (item.href.includes("/l/?uddg=")) return true;
          return !item.href.includes("duckduckgo.com");
        })
        .slice(0, 3);
      return items;
    });
    console.log(`[Crawler] Found Top Results:`, results.length);
    await page.close();

    // 3. Deep Scrape Top URLs in Parallel (Optional enhancement, but for now we have title and snippet)
    // To keep it fast, we can use the DDG snippet as the title and summary if it's good enough
    // but the user wants 3-5 topics per section.

    return { organic: results };
  } catch (error) {
    console.warn("Scrape Web Critical Error:", error);
    return { organic: [] };
  } finally {
    await browser.close();
  }
}

export async function scrapeImages(query: string, fallbackQuery?: string) {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15"
    );

    // Optimization: Block heavy assets.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (
        ["image", "font", "media", "stylesheet"].includes(req.resourceType())
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const tryFetch = async (q: string) => {
      const url = `https://unsplash.com/s/photos/${encodeURIComponent(q)}`;
      console.log(`[Crawler] Navigating to: ${url}`);
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        await page.waitForSelector('a[href^="/photos/"] img', {
          timeout: 8000,
        });

        return await page.evaluate(() => {
          const specificImages = document.querySelectorAll(
            'a[href^="/photos/"] img'
          );
          for (const img of specificImages) {
            if (
              img instanceof HTMLImageElement &&
              img.src &&
              img.src.includes("images.unsplash.com")
            ) {
              return img.src;
            }
          }
          const figures = document.querySelectorAll("figure img");
          for (const img of figures) {
            if (
              img instanceof HTMLImageElement &&
              img.src &&
              img.src.includes("images.unsplash.com") &&
              !img.src.includes("profile")
            ) {
              return img.src;
            }
          }
          return null;
        });
      } catch (e) {
        console.warn(`[Crawler] Failed search for: "${q}"`);
        return null;
      }
    };

    let imageUrl = await tryFetch(query);

    // If no image found and we have a fallback, try again
    if (!imageUrl && fallbackQuery && fallbackQuery !== query) {
      if (/[^\x00-\x7F]/.test(fallbackQuery)) {
        console.warn(
          `[Crawler] Skipping fallback query as it contains non-English characters: "${fallbackQuery}"`
        );
      } else {
        console.log(
          `[Crawler] Specific query failed. Trying fallback: "${fallbackQuery}"`
        );
        imageUrl = await tryFetch(fallbackQuery);
      }
    }

    if (imageUrl) {
      // Optimize image URL for faster loading
      if (imageUrl.includes("images.unsplash.com")) {
        const url = new URL(imageUrl);
        url.searchParams.set("q", "80");
        url.searchParams.set("w", "1080");
        url.searchParams.set("fit", "max");
        imageUrl = url.toString();
      }
      console.log(`[Crawler] Found image: ${imageUrl.substring(0, 50)}...`);
    } else {
      console.warn(`[Crawler] No image found for "${query}" (and fallback)`);
    }

    return imageUrl;
  } catch (error) {
    console.error(`[Crawler] Critical Error in scrapeImages:`, error);
    return null;
  } finally {
    await browser.close();
  }
}
