const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

const angleText = document.getElementById('angleText');
const targetText = document.getElementById('targetText');
const statusText = document.getElementById('statusText');
const progressEl = document.getElementById('progress');
const startGuideBtn = document.getElementById('startGuide');

let currentAngle = 0;
let currentTilt = 0;

// 30% overlap (horizontal)
const targets = [0, 60, 120, 180, 240, 300];

// 3 vertical rows
const rows = [
    { name: "TOP", tilt: 30 },
    { name: "MIDDLE", tilt: 0 },
    { name: "BOTTOM", tilt: -30 }
];

let currentRowIndex = 0;
let currentTargetIndex = 0;

let capturedFlags = new Array(targets.length).fill(false);

// Hold system
let holding = false;
let holdStartTime = null;

const HOLD_TIME = 1000;
const ANGLE_TOLERANCE = 8;
const TILT_TOLERANCE = 12;

// ---------- CAMERA ----------
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        video.srcObject = stream;
    } catch (err) {
        alert("Camera error: " + err.message);
    }
}
startCamera();

// ---------- NORMALIZE ----------
function normalize(angle) {
    return (angle + 360) % 360;
}

// ---------- CAPTURE ----------
function capturePhoto(index) {
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const imgData = canvas.toDataURL("image/png");

    const img = document.createElement("img");
    img.src = imgData;
    gallery.appendChild(img);

    capturedFlags[index] = true;
}

// ---------- ORIENTATION ----------
function handleOrientation(event) {

    let alpha = event.alpha;
    let beta = event.beta || 0;

    if (alpha === null) return;

    currentAngle = normalize(alpha);
    currentTilt = beta;

    let row = rows[currentRowIndex];
    let target = targets[currentTargetIndex];

    angleText.innerText = "Angle: " + Math.round(currentAngle) + "°";
    targetText.innerText = `Target: ${target}° | ${row.name}`;

    // ---------- TILT CHECK ----------
    let tiltDiff = Math.abs(currentTilt - row.tilt);

    if (tiltDiff > TILT_TOLERANCE) {
        holding = false;

        statusText.innerText = `📱 Tilt ${row.name}`;
        statusText.style.color = "#ff9800";

        progressEl.style.background =
            `conic-gradient(#888 0deg, transparent 0deg)`;

        return;
    }

    // ---------- ANGLE CHECK ----------
    let diff = Math.abs(currentAngle - target);
    if (diff > 180) diff = 360 - diff;

    if (diff < ANGLE_TOLERANCE) {

        statusText.innerText = "✅ Hold steady...";
        statusText.style.color = "#00c853";

        if (!holding && !capturedFlags[currentTargetIndex]) {
            holding = true;
            holdStartTime = Date.now();

            if (navigator.vibrate) navigator.vibrate(50);
        }

        if (holding) {
            let elapsed = Date.now() - holdStartTime;
            let progress = Math.min(elapsed / HOLD_TIME, 1);

            progressEl.style.background =
                `conic-gradient(#00c853 ${progress * 360}deg, transparent 0deg)`;

            if (elapsed >= HOLD_TIME) {

                capturePhoto(currentTargetIndex);

                holding = false;
                progressEl.style.background =
                    `conic-gradient(#888 0deg, transparent 0deg)`;

                statusText.innerText = "📸 Captured!";
                statusText.style.color = "#fff";

                currentTargetIndex++;

                // ---------- NEXT STEP ----------
                if (currentTargetIndex >= targets.length) {

                    currentRowIndex++;
                    currentTargetIndex = 0;
                    capturedFlags = new Array(targets.length).fill(false);

                    if (currentRowIndex >= rows.length) {
                        window.removeEventListener('deviceorientation', handleOrientation);
                        alert("✅ Full 360 sphere captured!");
                        return;
                    }

                    statusText.innerText = `➡️ Move to ${rows[currentRowIndex].name}`;
                }
            }
        }

    } else {
        holding = false;

        statusText.innerText = "➡️ Move to target";
        statusText.style.color = "#ccc";

        progressEl.style.background =
            `conic-gradient(#888 0deg, transparent 0deg)`;
    }
}

// ---------- START ----------
startGuideBtn.addEventListener('click', () => {

    currentRowIndex = 0;
    currentTargetIndex = 0;
    capturedFlags = new Array(targets.length).fill(false);

    gallery.innerHTML = "";

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(res => {
                if (res === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            });
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
});