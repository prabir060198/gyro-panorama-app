const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

const angleText = document.getElementById('angleText');
const targetText = document.getElementById('targetText');
const statusText = document.getElementById('statusText');
const progressEl = document.getElementById('progress');
const startGuideBtn = document.getElementById('startGuide');

let stream = null;
let currentAngle = 0;

// 30% overlap → 60° steps
const targets = [0, 60, 120, 180, 240, 300];

let currentTargetIndex = 0;
let capturedFlags = new Array(targets.length).fill(false);

// Hold system
let holding = false;
let holdStartTime = null;

const HOLD_TIME = 1000; // 1 second
const TOLERANCE = 8;

// Start camera
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        video.srcObject = stream;
    } catch (err) {
        alert("Camera error: " + err.message);
    }
}
startCamera();

// Normalize angle
function normalize(angle) {
    return (angle + 360) % 360;
}

// Capture image
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

// Orientation handler
function handleOrientation(event) {
    let alpha = event.alpha;
    if (alpha === null) return;

    currentAngle = normalize(alpha);

    angleText.innerText = "Angle: " + Math.round(currentAngle) + "°";

    let target = targets[currentTargetIndex];
    targetText.innerText = "Target: " + target + "°";

    let diff = Math.abs(currentAngle - target);
    if (diff > 180) diff = 360 - diff;

    if (diff < TOLERANCE) {

        // ALIGNED
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

                if (currentTargetIndex >= targets.length) {
                    window.removeEventListener('deviceorientation', handleOrientation);
                    alert("✅ All images captured!");
                }
            }
        }

    } else {
        // NOT ALIGNED
        holding = false;

        statusText.innerText = "➡️ Move to target";
        statusText.style.color = "#ccc";

        progressEl.style.background =
            `conic-gradient(#888 0deg, transparent 0deg)`;
    }
}

// Start guided capture
startGuideBtn.addEventListener('click', () => {

    currentTargetIndex = 0;
    capturedFlags = new Array(targets.length).fill(false);
    gallery.innerHTML = "";

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    alert("Permission denied");
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
});