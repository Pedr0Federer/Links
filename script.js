// === מסך פתיחה - וידאו אינטרו (Intro Splash) + טעינה מקדימה של נכסים קריטיים ===
(function () {
    "use strict";

    const INTRO_SAFETY_MS = 6000; // רשת ביטחון מוחלטת: מכסה גם "לא התחיל בכלל" (autoplay חסום) וגם "נתקע באמצע"
    const PAGE_READY_FALLBACK_MS = 2500; // אם window.load מתעכב/לא מגיע, לא נתקעים גם כאן

    // ניקוי הגנתי - מסירים כל דגל מצב ישן (session/local storage) שעלול לגרום לדילוג על האינטרו
    // או לחסום את תזמון הטעינה בביקור חוזר. גם אם לא אנחנו יצרנו אותו, לא נותנים לו להישאר.
    try {
        sessionStorage.removeItem("introPlayed");
        localStorage.removeItem("introPlayed");
    } catch (e) {
        // אחסון חסום (למשל מצב פרטי) - לא קריטי, פשוט ממשיכים
    }

    // אם הדף משוחזר מ-bfcache (ניווט אחורה/קדימה) הוא עלול לחזור במצב "כבר הסתיים" בלי שאף
    // קוד ירוץ מחדש. רענון מלא מבטיח שכל ביקור - כולל "ביקור שני" - יתחיל תמיד מאפס בצורה נקייה.
    window.addEventListener("pageshow", function (event) {
        if (event.persisted) {
            window.location.reload();
        }
    });

    // === רקע וידאו לופ - ניגון מיידי + נסיון חוזר במגע/קליק ראשון אם המדיניות autoplay חוסמת ===
    function playBackgroundVideo() {
        const bgVideo = document.getElementById("bg-video");
        if (!bgVideo) return;

        function attemptPlay() {
            bgVideo.muted = true;
            try {
                return bgVideo.play() || Promise.resolve();
            } catch (err) {
                return Promise.reject(err);
            }
        }

        // ניגון מיידי בטעינה - עם fallback שקט אם autoplay נחסם, עד למגע/קליק ראשון
        attemptPlay().catch(function () {
            function retryOnGesture() {
                document.removeEventListener("touchstart", retryOnGesture);
                document.removeEventListener("pointerdown", retryOnGesture);
                document.removeEventListener("click", retryOnGesture);
                attemptPlay().catch(function () {});
            }
            document.addEventListener("touchstart", retryOnGesture, { once: true, passive: true });
            document.addEventListener("pointerdown", retryOnGesture, { once: true });
            document.addEventListener("click", retryOnGesture, { once: true });
        });

        // כשהטאב גלוי/פעיל - הווידאו חייב להיות מנוגן; כשהוא מוסתר - משהים כדי לחסוך CPU/GPU
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) {
                bgVideo.pause();
            } else {
                attemptPlay().catch(function () {});
            }
        });
    }

    playBackgroundVideo();

    // playIntroSplash מנגן את הסרטון ומחזיר Promise שמתממש כשהוא מסתיים (בדרך זו או אחרת) -
    // הוא לא נוגע בשכבת הפתיחה עצמה (fade/הסרה); זה קורה רק אחרי שגם התמונות הקריטיות מוכנות,
    // כדי שהאוברליי ישמש כ"מסך טעינה" נקי לאורך כל הזמן הזה בלי הבזק של רקע לא טעון באמצע.
    function playIntroSplash() {
        return new Promise((resolve) => {
            const videoEl = document.getElementById("introVideo");
            if (!videoEl) { resolve(); return; }

            let finished = false;
            let safetyTimer = null;

            function finish() {
                if (finished) return;
                finished = true;
                if (safetyTimer) clearTimeout(safetyTimer);
                resolve();
            }

            // רשת ביטחון מוחלטת - לא משנה מה קורה עם הסרטון (autoplay חסום, קובץ נכשל, ניגון נתקע וכו')
            safetyTimer = setTimeout(finish, INTRO_SAFETY_MS);

            videoEl.addEventListener("ended", finish);
            videoEl.addEventListener("error", finish);
            videoEl.addEventListener("stalled", finish);

            // חושפים את הווידאו במפורש *לפני* ניסיון הניגון (לא סומכים על טיימינג עצמאי של CSS)
            videoEl.classList.add("intro-video-ready");

            function attemptPlay() {
                // אכיפה מפורשת של muted לפני כל ניסיון play(), כדי לעמוד במדיניות ה-autoplay של הדפדפנים
                videoEl.muted = true;
                try {
                    return videoEl.play() || Promise.resolve();
                } catch (err) {
                    return Promise.reject(err);
                }
            }

            function speedUpPlayback() {
                // ברגע שהניגון באמת התחיל - מהירות מעט מהירה יותר כדי שהאינטרו ירגיש קצבי וזריז יותר
                videoEl.playbackRate = 1.25;
            }

            attemptPlay().then(speedUpPlayback).catch(function () {
                // בדפדפני מובייל (iOS Safari / Chrome) מדיניות ה-autoplay עלולה לחסום ניגון
                // גם כשהווידאו מושתק - מנסים שוב מיד עם המגע/הקליק הראשון של המשתמש, בלי לוותר
                // על האינטרו מראש. רשת הביטחון (safetyTimer) ממשיכה לדאוג שלעולם לא ניתקע.
                function cleanupGestureListeners() {
                    document.removeEventListener("touchstart", retryOnGesture);
                    document.removeEventListener("pointerdown", retryOnGesture);
                    document.removeEventListener("click", retryOnGesture);
                }
                function retryOnGesture() {
                    if (finished) return;
                    // מסירים את שני המאזינים האחרים כדי לא להשאיר listeners תלויים ומיותרים
                    cleanupGestureListeners();
                    attemptPlay().then(speedUpPlayback).catch(function () {});
                }
                document.addEventListener("touchstart", retryOnGesture, { once: true, passive: true });
                document.addEventListener("pointerdown", retryOnGesture, { once: true });
                document.addEventListener("click", retryOnGesture, { once: true });
            });
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

        // טעינה מפורשת של הנכסים הקריטיים (רקע ראשי, כל לוגואי הכרטיסים, תמונת הפופ-אפ) -
        // כדי שהפופ-אפ והאתר הראשי לעולם לא ייחשפו לפני שהם באמת זמינים
        const criticalImages = Promise.all([
            "profile.jpg",
            "promo.png",
            "Discord_logo.png",
            "Kick_logo.png",
            "Youtube_logo.png",
            "instagram_logo.png",
            "tiktok_logo.png",
            "Reddit_logo.png",
            "PFKAY.png",
            "ky_logo.png"
        ].map(preloadImage));

        return Promise.all([windowLoad, criticalImages]);
    }

    window.playIntroSplash = playIntroSplash;
    window.waitForPageReady = waitForPageReady;
})();
