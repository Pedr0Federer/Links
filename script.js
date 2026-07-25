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
// במבנה ה-CSS/JS עצמו. במקום לנחש/להניח, מודדים בפועל את קצב הפריימים בזמן אמת, ואם
// הוא נמוך מדי - מוסיפים מחלקה שמפעילה נפילה חיננית ב-CSS (ר' style.css) ועוצרים את
// לולאת הקנבס (ר' index.html) כדי להוריד את העומס למינימום האפשרי.
//
// BUGFIX: המדידה לא מתחילה מיד עם טעינת הסקריפט יותר - נמצא בבדיקה ישירה (ffprobe על
// assets/media/intro.mp4: 2.23 שניות, ~1.79 שניות בפועל אחרי playbackRate=1.25) שחלון
// המדידה המקורי (0-1.5 שניות מטעינת הדף) חופף כמעט לחלוטין לזמן שבו וידאו האינטרו עצמו
// מפוענח ומתנגן - פענוח וידאו הוא בדיוק אחד הדברים היקרים ביותר לחישוב, כך שקצב
// הפריימים הנמדד באותו חלון היה מוטה כלפי מטה באופן מלאכותי גם על חומרה חזקה לגמרי,
// וגרם לזיהוי-שווא של low-perf (התוצאה המורגשת: רקע הווידאו וכו' לא הופיעו אפילו כשהאצת
// החומרה בפועל דלוקה). כעת ממתינים SAMPLE_START_DELAY_MS (חופף את משך האינטרו + מרווח
// ביטחון) לפני שמתחילים לספור פריימים בכלל, כך שהמדידה משקפת ביצועים אמיתיים במצב יציב,
// לא עומס חד-פעמי של טעינת הדף
(function () {
    "use strict";

    const SAMPLE_START_DELAY_MS = 2000; // עולה על משך ניגון האינטרו בפועל (~1.79 שניות)
    const PERF_SAMPLE_MS = 1500; // חלון המדידה עצמו - 1.5 שניות, אחרי ההשהיה למעלה
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

        console.log(
            "[VideoBG] FPS sample: " + fps.toFixed(1) +
            " (threshold " + LOW_FPS_THRESHOLD + ") -> isLowPerfDevice=" + window.isLowPerfDevice
        );

        // ההחלטה על רקע הווידאו מחכה בכוונה לרגע הזה (סוף מדידת ה-FPS, אחרי ההשהיה
        // למעלה), לא רק לבדיקת ה-WebGL הסינכרונית שלמעלה - ר' initVideoBackground
        // להסבר המלא
        if (typeof window.initVideoBackground === "function") {
            window.initVideoBackground();
        }
    }

    setTimeout(function () {
        requestAnimationFrame(samplePerformance);
    }, SAMPLE_START_DELAY_MS);
})();

// === רקע וידאו - מותנה לגמרי בהאצת חומרה פעילה + low-perf כבוי, ורק אחרי שהקביעה
// הסופית ידועה (ר' הקריאה מלמעלה, בסוף מדידת ה-FPS הא-סינכרונית - לא רק הבדיקה
// הסינכרונית המיידית) - כדי למנוע בדיוק את התרחיש שגרם לבעיות בגרסה קודמת של התכונה
// הזו באתר הזה (ר' היסטוריית git: נוגן, התגלה כבד, הוסר תוך כדי ניגון - "הבזק" מיותר
// וגם בזבוז של הורדה/פענוח שכבר קרו לשווא). הרקע הסטטי (bg-jungle.webp, ר' body::before
// ב-style.css) הוא ברירת המחדל הבטוחה תמיד - זמין מהרגע הראשון בלי תלות בהחלטה הזו,
// וממשיך לשמש כרשת ביטחון (מוסתר ויזואלית מתחת לווידאו רק כשהוא באמת מתחיל לנגן
// בהצלחה, לעולם לא מוסר מה-DOM)
(function () {
    "use strict";

    const VIDEO_BG_SRC = "assets/media/BackVid.mp4";
    let alreadyDecided = false;

    function removeVideoBackground(video) {
        if (video && video.parentNode) video.parentNode.removeChild(video);
    }

    // לוג אבחון יחיד וברור - כך שב-DevTools (F12) אפשר לראות מיידית למה הווידאו כן/לא
    // פעיל, בלי לנחש. נקרא בכל נקודת החלטה (הצלחה או כל סיבת נפילה)
    function logDecision(active, reason) {
        if (active) {
            console.log("[VideoBG] Active (HW accelerated)");
        } else {
            console.log("[VideoBG] Fallback to static image: " + reason);
        }
    }

    window.initVideoBackground = function () {
        // נקרא פעם אחת בלבד לאורך חיי העמוד - מדידת ה-FPS עצמה כבר לא חוזרת על עצמה,
        // אבל ההגנה כאן מפורשת ליתר ביטחון
        if (alreadyDecided) return;
        alreadyDecided = true;

        if (window.isLowPerfDevice) {
            logDecision(false, "isLowPerfDevice=true (WebGL renderer check or measured FPS below threshold)");
            return;
        }
        // עקבי עם ההעדפה שכבר מכובדת באתר עבור אנימציות CSS אחרות (ר' style.css) -
        // וידאו רקע נגן-אוטומטית הוא בדיוק סוג התנועה שההעדפה הזו נועדה לצמצם
        try {
            if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                logDecision(false, "prefers-reduced-motion is set");
                return;
            }
        } catch (e) {
            // matchMedia לא זמין/נכשל - לא נחשב סיבה לחסום, ממשיכים כרגיל
        }

        const video = document.createElement("video");
        video.id = "bgVideo";
        video.className = "bg-video";
        video.src = VIDEO_BG_SRC;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.setAttribute("aria-hidden", "true");
        video.setAttribute("tabindex", "-1");

        // כשל טעינה (קובץ חסר/שבור/רשת) - מסירים לגמרי, הרקע הסטטי שכבר קיים ממשיך
        // להיראות בדיוק כפי שנראה עד עכשיו, בלי שום מעבר/הבזק מורגש
        video.addEventListener("error", function () {
            logDecision(false, "video failed to load (network error or missing/corrupt file)");
            removeVideoBackground(video);
        });

        // מוסיפים כילד ה-DOM הראשון של body (לפני #particles-bg/.glow-orb, שגם הם
        // z-index:-1) כדי שהם ימשיכו לצייר מעליו באותה שכבת עומק בדיוק כמו שהיו
        // מציירים מעל הרקע הסטטי
        document.body.insertBefore(video, document.body.firstChild);

        // אכיפה מפורשת של muted לפני play() (כמו ב-playIntroSplash), כדי לעמוד
        // במדיניות ה-autoplay של הדפדפנים גם כשמסתמכים גם על התכונה autoplay וגם על
        // קריאת play() יזומה
        video.muted = true;
        video.play().then(function () {
            logDecision(true);
        }).catch(function (err) {
            // מדיניות autoplay חסמה ניגון (נדיר עבור מושתק, אבל קורה) - מסירים לגמרי
            // במקום להשאיר <video> שחור/ריק תקוע במקום הרקע התקין
            logDecision(false, "autoplay blocked by browser (" + (err && err.name ? err.name : err) + ")");
            removeVideoBackground(video);
        });
    };
})();
