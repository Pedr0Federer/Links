// === זיהוי מיידי וסינכרוני של רינדור-תוכנה (Hardware Acceleration כבוי) ===
// מד ה-FPS למטה (בהמשך הקובץ) לוקח 1.5 שניות עד שיש תוצאה - יותר מדי זמן כדי להחליט
// אם בכלל להתחיל לנגן את וידאו האינטרו: אם הוא יתחיל לנגן על רינדור תוכנה, המשתמש כבר
// יראה גמגום/סטאטר לפני שהמדידה תספיק לזהות זאת ולעצור אותו. כשכרום מכבה האצת חומרה,
// WebGL נופל לרנדרר-תוכנה (בד"כ "SwiftShader"/"llvmpipe"/"Basic Render") - את זה אפשר
// לבדוק באופן מיידי וסינכרוני, לפני שמנסים לנגן כל מדיה שהיא
(function () {
    "use strict";

    function detectSoftwareRendering() {
        try {
            const canvas = document.createElement("canvas");
            const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) return true; // אין WebGL בכלל בדפדפן הזה - נתייחס כאל מקרה בעייתי
            const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            if (!debugInfo) return false; // לא ניתן לזהות - לא מניחים את הגרוע מכל
            const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "");
            return /swiftshader|software|llvmpipe|basic render/i.test(renderer);
        } catch (e) {
            return false;
        }
    }

    if (detectSoftwareRendering()) {
        window.isLowPerfDevice = true;
        document.body.classList.add("low-perf");
    }
})();

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

    // playIntroSplash מנגן את הסרטון ומחזיר Promise שמתממש כשהוא מסתיים (בדרך זו או אחרת) -
    // הוא לא נוגע בשכבת הפתיחה עצמה (fade/הסרה); זה קורה רק אחרי שגם התמונות הקריטיות מוכנות,
    // כדי שהאוברליי ישמש כ"מסך טעינה" נקי לאורך כל הזמן הזה בלי הבזק של רקע לא טעון באמצע.
    function playIntroSplash() {
        return new Promise((resolve) => {
            // ביצועים נמוכים (רינדור תוכנה) - פענוח וידאו הוא בדיוק אחד הדברים היקרים ביותר
            // במצב הזה. מדלגים על הסרטון לגמרי במקום לתת לו להתחיל ולגמגם - עדיין ממתינים
            // ל-waitForPageReady (התמונות הקריטיות), כך שהמעבר לאתר הראשי נשאר "מסך טעינה"
            // נקי ללא הבזק, רק בלי סטאטר של פענוח וידאו
            if (window.isLowPerfDevice) {
                resolve();
                return;
            }

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
            "assets/images/profile.jpg",
            "assets/images/bg-jungle.webp",
            "assets/images/promo.png",
            "assets/images/Discord_logo.png",
            "assets/images/Kick_logo.png",
            "assets/images/Youtube_logo.png",
            "assets/images/instagram_logo.png",
            "assets/images/tiktok_logo.png",
            "assets/images/Reddit_logo.png",
            "assets/images/PFKAY.png",
            "assets/images/ky_logo.png"
        ].map(preloadImage));

        return Promise.all([windowLoad, criticalImages]);
    }

    window.playIntroSplash = playIntroSplash;
    window.waitForPageReady = waitForPageReady;
})();

// === ניטור ביצועים (FPS) + נפילה חיננית ל-CPU rendering ===
// כשהאצת חומרה (Hardware Acceleration) כבויה בכרום, הדפדפן עובר לרינדור תוכנה מלא -
// backdrop-filter וקנבס החלקיקים הופכים ליקרים באופן קיצוני ללא קשר לכמה שהם מאופטמים
// במבנה ה-CSS/JS עצמו. במקום לנחש/להניח, מודדים בפועל את קצב הפריימים בזמן אמת מיד
// עם טעינת הדף, ואם הוא נמוך מדי - מוסיפים מחלקה שמפעילה נפילה חיננית ב-CSS (ר' style.css)
// ועוצרים את לולאת הקנבס (ר' index.html) כדי להוריד את העומס למינימום האפשרי
(function () {
    "use strict";

    const PERF_SAMPLE_MS = 1500; // חלון המדידה - 1.5 שניות ראשונות
    const LOW_FPS_THRESHOLD = 35; // מתחת לזה - נחשב רינדור תוכנה/חומרה חלשה

    let frameCount = 0;
    let sampleStartTime = null;

    function samplePerformance(timestamp) {
        if (sampleStartTime === null) {
            sampleStartTime = timestamp;
        }
        frameCount++;
        const elapsed = timestamp - sampleStartTime;

        if (elapsed < PERF_SAMPLE_MS) {
            requestAnimationFrame(samplePerformance);
            return;
        }

        const fps = (frameCount / elapsed) * 1000;
        // דגל גלובלי - נבדק פר-פריים בלולאת הקנבס ב-index.html, כדי שהיא תיעצר גם אם
        // כבר התחילה לרוץ לפני שהמדידה כאן הסתיימה. לא "מבטלים" זיהוי low-perf קודם
        // (למשל מה-detectSoftwareRendering הסינכרוני למעלה) גם אם ה-FPS יצא תקין -
        // ברגע שזוהה כבד פעם אחת, נשארים במצב הזה למשך כל הביקור בעמוד
        const measuredLowPerf = fps < LOW_FPS_THRESHOLD;
        window.isLowPerfDevice = window.isLowPerfDevice || measuredLowPerf;
        if (window.isLowPerfDevice && document.body) {
            document.body.classList.add("low-perf");
        }
    }

    requestAnimationFrame(samplePerformance);
})();
