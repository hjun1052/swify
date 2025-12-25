const puppeteer = require('puppeteer');

async function scrapeImages(query) {
  console.log(`Testing Unsplash scrape for: ${query}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Unsplash Search
    const url = `https://unsplash.com/s/photos/${encodeURIComponent(query)}`;
    console.log(`Navigating to: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    try {
      await page.waitForSelector('a[href^="/photos/"] img', { timeout: 10000 });
      console.log("Selector a[href^='/photos/'] img found!");
    } catch (e) {
      console.log("Wait for selector failed");
    }

    const imageUrl = await page.evaluate(() => {
      const specificImages = document.querySelectorAll('a[href^="/photos/"] img');
      if (specificImages.length > 0) return specificImages[0].src;

      const images = document.querySelectorAll('figure img');
      for (const img of images) {
        if (img.src && img.src.includes('images.unsplash.com') && !img.src.includes('profile')) {
          return img.src;
        }
      }
      return null;
    });

    console.log("Found Image URL:", imageUrl);
    return imageUrl;

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
}

// Test with a guaranteed hit
scrapeImages("artificial intelligence");
