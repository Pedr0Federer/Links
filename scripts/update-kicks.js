// מריץ ה-GitHub Action המתוזמן (ר' .github/workflows/update-kicks.yml) - שולף לידרבורד
// Kicks אמיתי מ-endpoint פנימי לא-מתועד של Kick עצמו (לא צד שלישי, לא דורש OAuth) וכותב
// תמונת מצב סטטית ל-data/kicks.json, שהאתר קורא ב-fetch רגיל (same-origin, בלי proxy/CORS).
//
// אם השליפה נכשלת (Cloudflare, תקלת רשת וכו') אחרי כל הניסיונות החוזרים - הסקריפט יוצא עם
// קוד שגיאה בלי לכתוב כלום, כך שקובץ ה-JSON הקודם (עדיין תקין) נשאר במקום, ולא מוחלף
// בנתונים ריקים/שבורים
//
// משתמשים ב-curl (child_process) במקום ב-fetch המובנה של Node בכוונה - נבדק ישירות: אותה
// בקשה בדיוק, לאותו endpoint, מצליחה תמיד דרך curl אבל נחסמת ב-403 ע"י Cloudflare דרך
// fetch/undici של Node. כנראה טביעת אצבע TLS/HTTP שונה בין השניים - לא הונח מראש, זו
// תוצאה של בדיקה חיה. אם בעתיד גם curl ייחסם, יהיה צורך לעבור לדפדפן אמיתי (למשל Puppeteer
// עם stealth plugin, בדומה לפתרון שנמצא באתר אחר שמשתמש באותו endpoint)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const CHANNEL_ID = "7940746"; // pedrofederer
const ENDPOINT = `https://web.kick.com/api/v1/kicks/${CHANNEL_ID}/leaderboard`;
const OUTPUT_PATH = path.join(__dirname, "..", "data", "kicks.json");
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
    const rawJson = execFileSync(
        "curl",
        ["-s", "-f", "-A", USER_AGENT, "-H", "Accept: application/json", "--max-time", "15", ENDPOINT],
        { encoding: "utf8" }
    );

    const json = JSON.parse(rawJson);
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
