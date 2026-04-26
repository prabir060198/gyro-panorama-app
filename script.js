const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

const angleText = document.getElementById('angleText');
const statusText = document.getElementById('statusText');
const progressEl = document.getElementById('progress');
const startGuideBtn = document.getElementById('startGuide');

// Debug elements
const yawVal = document.getElementById('yawVal');
const betaVal = document.getElementById('betaVal');
const pitchVal = document.getElementById('pitchVal');
const gammaVal = document.getElementById('gammaVal');

let currentAngle = 0;
let currentPitch = 0;

let holding = false;
let holdStartTime = null;

const HOLD_TIME = 1000;

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

// ---------- CAPTURE ----------
function capturePhoto() {
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const imgData = canvas.toDataURL("image/png");

    const img = document.createElement("img");
    img.src = imgData;
    gallery.appendChild(img);
}

// ---------- ORIENTATION ----------
function handleOrientation(event) {

    let alpha = event.alpha;
    let beta = event.beta || 0;
    let gamma = event.gamma || 0;

    if (alpha === null) return;

    // Yaw
    let yaw = (alpha + 360) % 360;

    // Pitch (corrected)
    let pitch = beta - 90;

    // Debug UI
    yawVal.innerText = Math.round(yaw);
    betaVal.innerText = Math.round(beta);
    pitchVal.innerText = Math.round(pitch);
    gammaVal.innerText = Math.round(gamma);

    // Store
    currentAngle = yaw;
    currentPitch = pitch;

    angleText.innerText = "Yaw: " + Math.round(yaw);

    // Example capture trigger (simple hold at center)
    if (Math.abs(pitch) < 10) {

        statusText.innerText = "Hold steady...";

        if (!holding) {
            holding = true;
            holdStartTime = Date.now();
        }

        let elapsed = Date.now() - holdStartTime;
        let progress = Math.min(elapsed / HOLD_TIME, 1);

        progressEl.style.background =
            `conic-gradient(#00c853 ${progress * 360}deg, transparent 0deg)`;

        if (elapsed >= HOLD_TIME) {
            capturePhoto();
            holding = false;
            statusText.innerText = "Captured!";
        }

    } else {
        holding = false;
        statusText.innerText = "Align to center";
        progressEl.style.background =
            `conic-gradient(#888 0deg, transparent 0deg)`;
    }
}

// ---------- START ----------
startGuideBtn.addEventListener('click', () => {

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

    statusText.innerText = "Tracking started";
});