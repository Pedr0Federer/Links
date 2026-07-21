// === מסך פתיחה - וידאו אינטרו (Intro Splash) ===
(function () {
    "use strict";

    const INTRO_FAILSAFE_MS = 4500; // רשת ביטחון קשיחה - קריטי בהוסטינג כמו GitHub Pages: לעולם לא נתקעים על מסך שחור
    const INTRO_FADE_MS = 600;      // משך דעיכת שכבת הפתיחה (תואם ל-transition ב-CSS)

    function playIntroSplash() {
        return new Promise((resolve) => {
            const introEl = document.getElementById("introSplash");
            const videoEl = document.getElementById("introVideo");
            const skipBtn = document.getElementById("introSkipBtn");
            if (!introEl) { resolve(); return; }

            let finished = false;
            let failsafeTimer = null;

            function finishIntro() {
                if (finished) return;
                finished = true;
                if (failsafeTimer) clearTimeout(failsafeTimer);
                // דעיכה חלקה של שכבת הפתיחה, ואז הסרה מלאה מה-DOM כדי שלא תחסום קליקים.
                // משתמשים בטיימר קבוע (לא ב-transitionend) כדי שהסרה תמיד תקרה גם אם ה-transition לא רץ מסיבה כלשהי.
                introEl.classList.add("intro-hidden");
                setTimeout(() => {
                    introEl.remove();
                    resolve();
                }, INTRO_FADE_MS);
            }

            // רשת ביטחון קשיחה - לכל היותר 4.5 שניות, לא משנה מה קורה עם הסרטון (שגיאת רשת, autoplay חסום וכו')
            failsafeTimer = setTimeout(finishIntro, INTRO_FAILSAFE_MS);

            // כפתור "דלג" - מאפשר למשתמש לחשוף את האתר מיידית אם הטעינה מתעכבת
            if (skipBtn) {
                skipBtn.addEventListener("click", finishIntro);
            }

            if (!videoEl) { return; }

            videoEl.addEventListener("ended", finishIntro);
            videoEl.addEventListener("error", finishIntro);
            videoEl.addEventListener("stalled", finishIntro);

            // אכיפה מפורשת של muted לפני play(), כדי לעמוד במדיניות ה-autoplay של הדפדפנים גם אם המאפיין בתגית לא נקלט
            videoEl.muted = true;
            const playPromise = videoEl.play();
            if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch(finishIntro);
            }
        });
    }

    window.playIntroSplash = playIntroSplash;
})();
