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
    const base64 = fs.readFileSync(logoPath).toString("base64");
    logoUrl = `data:image/jpeg;base64,${base64}`;
  }

  let html = fs.readFileSync(templatePath, "utf8");

  html = html
    .replace(/\{\{image_url\}\}/g, escapeHtml(imageUrl || ""))
    .replace(/\{\{logo_url\}\}/g, escapeHtml(logoUrl))
    .replace(/\{\{heading\}\}/g, escapeHtml(heading || ""))
    .replace(/\{\{quote\}\}/g, escapeHtml(quote || "").replace(/\n/g, "<br>"));

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

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