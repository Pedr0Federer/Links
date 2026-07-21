// === מסך פתיחה - וידאו אינטרו (Intro Splash) ===
(function () {
    "use strict";

    function playIntroSplash() {
        return new Promise((resolve) => {
            const introEl = document.getElementById("introSplash");
            const videoEl = document.getElementById("introVideo");
            if (!introEl) { resolve(); return; }

            let finished = false;

            function finishIntro() {
                if (finished) return;
                finished = true;
                // דעיכה חלקה של שכבת הפתיחה, ואז הסרה מלאה מה-DOM ברגע שה-transition עצמו מסתיים (אירוע, לא טיימר)
                introEl.classList.add("intro-hidden");
                introEl.addEventListener("transitionend", () => {
                    introEl.remove();
                    resolve();
                }, { once: true });
            }

            if (!videoEl) { finishIntro(); return; }

            // המנגנון הראשי - הסרטון מתנגן במלואו עד הסוף הטבעי שלו, בלי חיתוך מוקדם
            videoEl.addEventListener("ended", finishIntro);

            // רשתות ביטחון מבוססות-אירוע בלבד (לא טיימרים) - קובץ שבור או שהניגון נתקע לגמרי
            videoEl.addEventListener("error", finishIntro);
            videoEl.addEventListener("stalled", finishIntro);

            function startPlayback() {
                videoEl.play().catch(finishIntro);
            }

            // ממתינים שהדפדפן יאותת שיש מספיק נתונים חוצצים כדי לנגן ברצף עד הסוף בלי הפרעות,
            // ורק אז מתחילים ניגון - כך נמנעים מהקפאות/גמגומים באמצע עקב חוסר buffering
            if (videoEl.readyState >= 4 /* HAVE_ENOUGH_DATA */) {
                startPlayback();
            } else {
                videoEl.addEventListener("canplaythrough", startPlayback, { once: true });
            }
        });
    }

    window.playIntroSplash = playIntroSplash;
})();
