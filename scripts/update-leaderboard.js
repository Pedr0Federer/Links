// מריץ ה-GitHub Action המתוזמן (ר' .github/workflows/update-leaderboard.yml) - שולף את
// לידרבורד ה-CSGORoll החי + קופת הפרסים ישירות מ-nickpf.com בצד השרת (לא דפדפן, בלי CORS,
// בלי פרוקסי צד-שלישי) וכותב תמונת מצב סטטית ל-data/leaderboard.json, שהאתר קורא same-origin
// בדיוק כמו data/kicks.json.
//
// למה זה קיים: העמוד נהג לשלוף את nickpf.com/api/* חי מהדפדפן דרך פרוקסי CORS ציבוריים
// (allorigins / codetabs / corsproxy). nickpf.com לא שולח כותרות CORS, אז הדפדפן לעולם לא
// יכול לקרוא לו ישירות, והפרוקסי הציבוריים לא אמינים - כשכולם נפלו בו-זמנית העמוד "נפל" בשקט
// ל-snapshot מוקשח (hard-coded) שהיה מיושן בחודשים (זה באג "הלידרבורד תקוע על החודש הקודם").
// nickpf.com עצמו הוא האתר של בעל הערוץ ועונה ל-fetch רגיל בצד שרת בלי חסימת בוטים, אז משיכה
// מתוזמנת בצד שרת היא פשוטה ואמינה.
//
// גלגול-חודש אוטומטי: nickpf.com/api/csgoroll-leaderboard ו-/api/prize?period=csgoroll תמיד
// מחזירים את אירוע החודש הנוכחי - אין שום month/campaign id בשום מקום - אז בכל מעבר חודש
// הסקריפט פשוט מתחיל לכתוב את נתוני החודש החדש אוטומטית, בלי עריכה ידנית.
//
// בכישלון (אחרי כל הניסיונות) הסקריפט יוצא עם קוד שגיאה בלי לכתוב כלום, כך שקובץ ה-JSON
// הקודם (עדיין תקין) נשאר במקום ולא מוחלף בנתונים ריקים/שבורים.
const fs = require("fs");
const path = require("path");

const LEADERBOARD_URL = "https://nickpf.com/api/csgoroll-leaderboard";
const PRIZE_URL = "https://nickpf.com/api/prize?period=csgoroll";
const PROMO_CODE = "PF5";
const DEFAULT_MONTHLY_REWARD = 2500;
const OUTPUT_PATH = path.join(__dirname, "..", "data", "leaderboard.json");
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
    const bust = `${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
    const res = await fetch(url + bust, {
        headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; nickpf-leaderboard-snapshot/1.0)",
        },
    });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return res.json();
}

function normalizePlayers(raw) {
    if (!raw || raw.success !== true || !Array.isArray(raw.players)) {
        throw new Error("unexpected leaderboard response shape (missing success/players)");
    }
    // רשימה ריקה היא מצב תקין לגמרי בתחילת חודש - לא זורקים שגיאה עליה
    return raw.players
        .filter((entry) => entry && typeof entry.name === "string")
        .map((entry) => ({
            name: entry.name,
            wagered: Number(entry.wagered || 0),
            avatar: typeof entry.avatar === "string" ? entry.avatar : "",
        }));
}

async function buildSnapshot() {
    const [rawLeaderboard, rawPrize] = await Promise.all([
        fetchJson(LEADERBOARD_URL),
        fetchJson(PRIZE_URL),
    ]);

    const players = normalizePlayers(rawLeaderboard);
    const monthlyReward =
        rawPrize && typeof rawPrize.monthlyPriceReward === "number"
            ? rawPrize.monthlyPriceReward
            : DEFAULT_MONTHLY_REWARD;

    const now = new Date();
    return {
        generatedAt: now.toISOString(),
        // החודש (UTC) שאליו התמונה שייכת - העמוד משתמש בזה כדי לפסול תמונת מצב של חודש
        // קודם ברגע שהשעון מתגלגל, עוד לפני שריצת ה-Action הבאה מפרסמת נתונים טריים
        period: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
        code: PROMO_CODE,
        monthlyReward,
        players,
    };
}

async function main() {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const snapshot = await buildSnapshot();
            fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
            fs.writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
            console.log(
                `Wrote ${OUTPUT_PATH}: period ${snapshot.period}, reward ${snapshot.monthlyReward}, ` +
                    `${snapshot.players.length} player(s).`
            );
            return;
        } catch (err) {
            lastError = err;
            console.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
            if (attempt < MAX_ATTEMPTS) await delay(RETRY_DELAY_MS);
        }
    }

    console.error(`All ${MAX_ATTEMPTS} attempts failed - leaving existing data/leaderboard.json untouched.`);
    console.error(lastError);
    process.exit(1);
}

main();
