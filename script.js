// === מסך פתיחה - וידאו אינטרו (Intro Splash) + מוכנות העמוד ===
(function () {
    "use strict";

    const INTRO_SAFETY_MS = 6000; // רשת ביטחון מוחלטת: מכסה גם "לא התחיל בכלל" וגם "נתקע באמצע"
    const INTRO_FADE_MS = 600;    // תואם למשך ה-transition של .intro-splash ב-CSS
    const PAGE_READY_FALLBACK_MS = 2500; // אם window.load מתעכב/לא מגיע, לא נתקעים גם כאן

    function playIntroSplash() {
        return new Promise((resolve) => {
            const introEl = document.getElementById("introSplash");
            const videoEl = document.getElementById("introVideo");
            if (!introEl) { resolve(); return; }

            let finished = false;
            let safetyTimer = null;

            function finishIntro() {
                if (finished) return;
                finished = true;
                if (safetyTimer) clearTimeout(safetyTimer);
                // דעיכה חלקה של שכבת הפתיחה, ואז הסרה מלאה מה-DOM כדי שלא תחסום קליקים
                introEl.classList.add("intro-hidden");
                setTimeout(() => {
                    introEl.remove();
                    resolve();
                }, INTRO_FADE_MS);
            }

            // רשת ביטחון מוחלטת - לא משנה מה קורה עם הסרטון (autoplay חסום, קובץ נכשל, ניגון נתקע וכו')
            safetyTimer = setTimeout(finishIntro, INTRO_SAFETY_MS);

            if (!videoEl) { return; }

            videoEl.addEventListener("ended", finishIntro);
            videoEl.addEventListener("error", finishIntro);
            videoEl.addEventListener("stalled", finishIntro);

            // מנסים לנגן מיידית - לא ממתינים לשום אירוע buffering שעלול לא להגיע בכלל
            videoEl.muted = true;
            const playPromise = videoEl.play();
            if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch(finishIntro);
            }
        });
    }

    function waitForPageReady() {
        // מחכים שכל משאבי העמוד (תמונות וכו') ייטענו בפועל (window.load),
        // עם רשת ביטחון קצרה למקרה שזה מתעכב/נכשל, כדי לא לתקוע את החשיפה של האתר
        return new Promise((resolve) => {
            if (document.readyState === "complete") { resolve(); return; }
            let done = false;
            function finish() {
                if (done) return;
                done = true;
                resolve();
            }
            window.addEventListener("load", finish, { once: true });
            setTimeout(finish, PAGE_READY_FALLBACK_MS);
        });
    }

    window.playIntroSplash = playIntroSplash;
    window.waitForPageReady = waitForPageReady;
})();
