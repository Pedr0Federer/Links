// מריץ ה-GitHub Action המתוזמן (ר' .github/workflows/update-kicks.yml) - שולף לידרבורד
// Kicks אמיתי מ-endpoint פנימי לא-מתועד של Kick עצמו (לא צד שלישי, לא דורש OAuth) וכותב
// תמונת מצב סטטית ל-data/kicks.json, שהאתר קורא ב-fetch רגיל (same-origin, בלי proxy/CORS).
//
// אם השליפה נכשלת (Cloudflare, תקלת רשת וכו') אחרי כל הניסיונות החוזרים - הסקריפט יוצא עם
// קוד שגיאה בלי לכתוב כלום, כך שקובץ ה-JSON הקודם (עדיין תקין) נשאר במקום, ולא מוחלף
// בנתונים ריקים/שבורים
//
// משתמשים ב-Puppeteer + puppeteer-extra-plugin-stealth, לא ב-fetch/curl - נבדק ישירות
// ובאופן חד-משמעי: מהמכונה המקומית שלי גם fetch המובנה של Node וגם curl פשוט נחסמו/עברו
// בהתאם ל-IP, אבל בהרצה אמיתית ב-GitHub Actions (לא הונח מראש - נבדק בהרצה חיה של ה-workflow
// עצמו) גם curl נחסם ב-403 ע"י Cloudflare - כנראה טווחי ה-IP הידועים של GitHub Actions
// חסומים/מסומנים מראש. דפדפן headless אמיתי עם stealth plugin (בדיוק כמו הפתרון שנמצא
// באתר אחר שמשתמש באותו endpoint פנימי) הוא הדרך היחידה שאומתה כעובדת מתוך CI בפועל
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const CHANNEL_ID = "7940746"; // pedrofederer
const ENDPOINT = `https://web.kick.com/api/v1/kicks/${CHANNEL_ID}/leaderboard`;
const OUTPUT_PATH = path.join(__dirname, "..", "data", "kicks.json");
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function toEntries(rawList) {
    if (!Array.isArray(rawList)) return [];
    return rawList
        .filter((entry) => entry && typeof entry.username === "string")
        .map((entry) => ({ username: entry.username, quantity: Number(entry.quantity || 0) }));
}

async function fetchKicksLeaderboard() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    let json;
    try {
        const page = await browser.newPage();
        await page.goto(ENDPOINT, { waitUntil: "networkidle2", timeout: 20000 });
        const bodyText = await page.evaluate(() => document.body.innerText);
        json = JSON.parse(bodyText);
    } finally {
        await browser.close();
    }

    const data = json && json.data;
    if (!data || !Array.isArray(data.kicks_gifts_lifetime)) {
        throw new Error("unexpected response shape: missing data.kicks_gifts_lifetime");
    }

    return {
        generatedAt: new Date().toISOString(),
        lifetime: toEntries(data.kicks_gifts_lifetime),
        weekly: toEntries(data.kicks_gifts_week),
    };
}

async function main() {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const snapshot = await fetchKicksLeaderboard();
            fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
            fs.writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
            console.log(`Wrote ${OUTPUT_PATH}: ${snapshot.lifetime.length} lifetime, ${snapshot.weekly.length} weekly entries.`);
            return;
        } catch (err) {
            lastError = err;
            console.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
            if (attempt < MAX_ATTEMPTS) await delay(RETRY_DELAY_MS);
        }
    }

    console.error(`All ${MAX_ATTEMPTS} attempts failed - leaving existing data/kicks.json untouched.`);
    console.error(lastError);
    process.exit(1);
}

main();
