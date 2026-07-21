// === מסך פתיחה - וידאו אינטרו (Intro Splash) + מוכנות העמוד ===
(function () {
    "use strict";

    const INTRO_SAFETY_MS = 6000; // רשת ביטחון מוחלטת: מכסה גם "לא התחיל בכלל" וגם "נתקע באמצע"
    const INTRO_FADE_MS = 600;    // תואם למשך ה-transition של .intro-splash ב-CSS
    const PAGE_READY_FALLBACK_MS = 2500; // אם window.load מתעכב/לא מגיע, לא נתקעים גם כאן

    // ניקוי הגנתי - מסירים כל דגל מצב ישן (session/local storage) שעלול לגרום לדילוג על האינטרו
    // או לחסום את תזמון הטעינה בביקור חוזר. גם אם לא אנחנו יצרנו אותו, לא נותנים לו להישאר.
    try {
        sessionStorage.removeItem("introPlayed");
        localStorage.removeItem("introPlayed");
    } catch (e) {
        // אחסון חסום (למשל מצב פרטי) - לא קריטי, פשוט ממשיכים
    }

    // אם הדף משוחזר מ-bfcache (ניווט אחורה/קדימה) הוא עלול לחזור במצב "כבר הסתיים" (עם
    // האינטרו כבר מוסר והפופ-אפ כבר מוצג/סגור מהביקור הקודם) בלי שאף קוד ירוץ מחדש.
    // רענון מלא מבטיח שכל ביקור - כולל "ביקור שני" - יתחיל תמיד מאפס בצורה נקייה.
    window.addEventListener("pageshow", function (event) {
        if (event.persisted) {
            window.location.reload();
        }
    });

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

    // טוענים תמונה בפועל (Image.onload) לפני שממשיכים - onerror נחשב "סיום" גם הוא כדי שקובץ
    // שבור/חסר לא יתקע את הרצף לנצח, פשוט ימשיך בלי לחכות לו יותר
    function preloadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = src;
        });
    }

    function waitForPageReady() {
        // מחכים שכל משאבי העמוד ייטענו בפועל (window.load), עם רשת ביטחון קצרה למקרה שזה מתעכב/נכשל
        const windowLoad = new Promise((resolve) => {
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

        // טעינה מפורשת של תמונת הרקע הראשית ותמונת הפופ-אפ הפרסומי - כדי שהפופ-אפ
        // לעולם לא ייפתח לפני שהתמונות שהוא (וגם רקע האתר) תלוי בהן זמינות בפועל
        const criticalImages = Promise.all([
            preloadImage("profile.jpg"),
            preloadImage("promo.png")
        ]);

        return Promise.all([windowLoad, criticalImages]);
    }

    window.playIntroSplash = playIntroSplash;
    window.waitForPageReady = waitForPageReady;
})();
