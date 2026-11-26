const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findLogoPath(folderPath) {
  const candidates = [
    "ccn-logo",
    "ccn-logo.jpg",
    "ccn-logo.jpeg",
    "ccn-logo.png",
    "ccn-logo.webp",
    "ccn-logo.jpg.jpeg",
    "ccn-logo.jpeg.jpg"
  ];

  for (const name of candidates) {
    const fullPath = path.join(folderPath, name);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

async function generateCard({ imageUrl, heading, quote, outputPath }) {
  const templatePath = path.join(__dirname, "card.html");
  const logoPath = findLogoPath(__dirname);
  let logoUrl = "";

  if (logoPath) {
    const ext = path.extname(logoPath).toLowerCase().replace(".", "");
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const base64 = fs.readFileSync(logoPath).toString("base64");
    logoUrl = `data:${mime};base64,${base64}`;
  }

  const safeImageUrl = (imageUrl && imageUrl.trim()) || logoUrl;
  const safeHeading = (heading && heading.trim()) || "Cricket Update";
  const safeQuote = (quote && quote.trim()) || "Latest match highlights and updates";

  console.log("Inputs received:", {
    imageUrl: safeImageUrl.startsWith("data:") ? "[base64-fallback]" : safeImageUrl,
    heading: safeHeading,
    quote: safeQuote
  });

  let html = fs.readFileSync(templatePath, "utf8");

  html = html
    .replace(/\{\{image_url\}\}/g, escapeHtml(safeImageUrl))
    .replace(/\{\{logo_url\}\}/g, escapeHtml(logoUrl))
    .replace(/\{\{heading\}\}/g, escapeHtml(safeHeading))
    .replace(/\{\{quote\}\}/g, escapeHtml(safeQuote).replace(/\n/g, "<br>"));

  // Agar image load fail ho toh fallback logo/image par switch kar de
  if (logoUrl) {
    html = html.replace(
      /<img\b([^>]*?)>/gi,
      (match, attrs) => {
        if (/onerror=/i.test(attrs)) return match;
        return `<img${attrs} onerror="this.onerror=null;this.src='${logoUrl}';">`;
      }
    );
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Images ke load ya timeout hone ka wait (max 8s)
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      await Promise.race([
        Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((res) => {
                  img.addEventListener("load", res, { once: true });
                  img.addEventListener("error", res, { once: true });
                })
          )
        ),
        new Promise((res) => setTimeout(res, 8000))
      ]);
    });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, type: "png" });
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const [, , imageUrl, heading, quote] = process.argv;
  generateCard({
    imageUrl,
    heading,
    quote,
    outputPath: path.join(__dirname, "output", "ig_card.png")
  })
    .then(() => console.log("Card generated successfully"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { generateCard };
