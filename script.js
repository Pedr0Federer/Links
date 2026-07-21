// === מסך פתיחה - וידאו אינטרו (Intro Splash) ===
// עיצוב "fail-proof": האוברליי מוסתר כברירת מחדל דרך CSS (ר' style.css), ונחשף ע"י הקוד כאן
// אך ורק אחרי שהסרטון מוכיח בפועל שהוא מתנגן (canplay/playing). הפונקציה נקראת מוקדם ככל האפשר
// - מיד אחרי אלמנט הווידאו ב-index.html - ולא ממתינה ל-DOMContentLoaded/window.onload של שאר הדף.
(function () {
    "use strict";

    const INTRO_SAFETY_MS = 5000; // טיימר ביטחון מוחלט - מכסה גם "לא התחיל בכלל" וגם "נתקע באמצע"
    const INTRO_FADE_MS = 550;    // תואם למשך ה-transition ב-CSS

    function playIntroSplash() {
        return new Promise((resolve) => {
            const introEl = document.getElementById("introSplash");
            const videoEl = document.getElementById("introVideo");
            const skipBtn = document.getElementById("introSkipBtn");

            if (!introEl) { resolve(); return; }

            let finished = false;
            let started = false;
            let safetyTimer = null;

            function finishIntro() {
                if (finished) return;
                finished = true;
                if (safetyTimer) clearTimeout(safetyTimer);
                introEl.classList.remove("intro-visible");
                // אם האוברליי מעולם לא הוצג בפועל - מסירים מיידית, בלי להמתין לדעיכה שלא קיימת
                setTimeout(() => {
                    introEl.remove();
                    resolve();
                }, started ? INTRO_FADE_MS : 0);
            }

            function revealIntro() {
                if (finished || started) return;
                started = true;
                console.log("[intro] confirmed playback (canplay/playing) - revealing overlay");
                introEl.classList.add("intro-visible");
            }

            // טיימר ביטחון מוחלט - יחיד, מכסה כל תרחיש (הדפדפן חוסם autoplay, קובץ נכשל, ניגון נתקע וכו')
            safetyTimer = setTimeout(function () {
                console.log("[intro] absolute 5s safety timer reached - clearing overlay");
                finishIntro();
            }, INTRO_SAFETY_MS);

            if (skipBtn) {
                skipBtn.addEventListener("click", finishIntro);
            }

            if (!videoEl) { return; }

            videoEl.addEventListener("canplay", revealIntro);
            videoEl.addEventListener("playing", revealIntro);

            // מעבר מיידי ברגע שהסרטון נגמר - בלי המתנה נוספת
            videoEl.addEventListener("ended", function () {
                console.log("[intro] video ended event fired");
                finishIntro();
            });

            videoEl.addEventListener("error", function (e) {
                console.log("[intro] video error event fired", videoEl.error, e);
                finishIntro();
            });

            videoEl.addEventListener("stalled", function () {
                console.log("[intro] video stalled event fired");
                finishIntro();
            });

            // אכיפה מפורשת - גם muted וגם defaultMuted - לפני קריאה ל-play(), כדי לעמוד במדיניות ה-autoplay
            videoEl.muted = true;
            videoEl.defaultMuted = true;

            let playPromise;
            try {
                playPromise = videoEl.play();
                console.log("[intro] video.play() called");
            } catch (err) {
                console.log("[intro] video.play() threw synchronously", err);
                finishIntro();
                return;
            }

            if (playPromise && typeof playPromise.catch === "function") {
                playPromise
                    .then(function () {
                        console.log("[intro] play() promise resolved");
                    })
                    .catch(function (err) {
                        console.log("[intro] play() promise rejected", err);
                        finishIntro();
                    });
            }
        });
    }

    window.playIntroSplash = playIntroSplash;
})();
