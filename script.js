const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

const angleText = document.getElementById('angleText');
const targetText = document.getElementById('targetText');
const statusText = document.getElementById('statusText');
const progressEl = document.getElementById('progress');
const startGuideBtn = document.getElementById('startGuide');
const downloadBtn = document.getElementById('downloadAll');

const previewModal = document.getElementById('previewModal');
const previewImg = document.getElementById('previewImg');

let currentAngle = 0;
let currentPitch = 0;

// ✅ 8 directions (45° step)
const targets = [0,45,90,135,180,225,270,315];

// ✅ 4 rows
const rows = [
    { name: "LOWER", pitch: -60 },
    { name: "BOTTOM_LOW", pitch: -20 },
    { name: "BOTTOM_UP", pitch: 20 },
    { name: "TOP", pitch: 60 }
];

let currentRowIndex = 0;
let currentTargetIndex = 0;

let capturedFlags = new Array(targets.length).fill(false);

let holding = false;
let holdStartTime = null;

const HOLD_TIME = 1000;
const ANGLE_TOLERANCE = 8;
const TILT_TOLERANCE = 12;

let allImages = [];

// CAMERA
async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
    });
    video.srcObject = stream;
}
startCamera();

// NORMALIZE
function normalize(angle) {
    return (angle + 360) % 360;
}

// CAPTURE
function capturePhoto(index) {
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const imgData = canvas.toDataURL("image/png");
    allImages.push(imgData);

    const img = document.createElement("img");
    img.src = imgData;

    img.onclick = () => {
        previewModal.style.display = "flex";
        previewImg.src = imgData;
    };

    gallery.appendChild(img);

    capturedFlags[index] = true;
}

// ORIENTATION
function handleOrientation(event) {

    let alpha = event.alpha;
    let beta = event.beta || 0;
    let gamma = event.gamma || 0;

    if (alpha === null) return;

    currentAngle = normalize(alpha);

    let x = beta * Math.PI / 180;
    let y = gamma * Math.PI / 180;

    currentPitch = Math.atan2(
        Math.sin(x),
        Math.cos(x) * Math.cos(y)
    ) * (180 / Math.PI);

    let row = rows[currentRowIndex];
    let target = targets[currentTargetIndex];

    angleText.innerText = `Yaw: ${Math.round(currentAngle)}`;
    targetText.innerText = `Target: ${target}° | ${row.name}`;

    // PITCH CHECK
    let tiltDiff = Math.abs(currentPitch - row.pitch);

    if (tiltDiff > TILT_TOLERANCE) {
        holding = false;
        statusText.innerText = `Adjust ${row.name}`;
        return;
    }

    // ANGLE CHECK
    let diff = Math.abs(currentAngle - target);
    if (diff > 180) diff = 360 - diff;

    if (diff < ANGLE_TOLERANCE) {

        statusText.innerText = "Hold steady...";

        if (!holding && !capturedFlags[currentTargetIndex]) {
            holding = true;
            holdStartTime = Date.now();
        }

        let elapsed = Date.now() - holdStartTime;
        let progress = Math.min(elapsed / HOLD_TIME, 1);

        progressEl.style.background =
            `conic-gradient(#00c853 ${progress * 360}deg, transparent 0deg)`;

        if (elapsed >= HOLD_TIME) {

            capturePhoto(currentTargetIndex);

            holding = false;
            progressEl.style.background =
                `conic-gradient(#888 0deg, transparent 0deg)`;

            currentTargetIndex++;

            if (currentTargetIndex >= targets.length) {

                currentRowIndex++;
                currentTargetIndex = 0;
                capturedFlags = new Array(targets.length).fill(false);

                if (currentRowIndex >= rows.length) {
                    window.removeEventListener('deviceorientation', handleOrientation);

                    statusText.innerText = "✅ 32 Images Captured!";
                    downloadBtn.classList.remove("hidden");
                    return;
                }

                statusText.innerText = `➡️ Move to ${rows[currentRowIndex].name}`;
            }
        }

    } else {
        holding = false;
        statusText.innerText = "Move to target";
    }
}

// START
startGuideBtn.addEventListener('click', () => {

    currentRowIndex = 0;
    currentTargetIndex = 0;
    capturedFlags = new Array(targets.length).fill(false);

    allImages = [];
    gallery.innerHTML = "";
    downloadBtn.classList.add("hidden");

    statusText.innerText = "Start capturing";

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

// PREVIEW
previewModal.onclick = () => {
    previewModal.style.display = "none";
};

// DOWNLOAD
downloadBtn.onclick = () => {
    allImages.forEach((img, i) => {
        const a = document.createElement("a");
        a.href = img;
        a.download = `photo_${i}.png`;
        a.click();
    });
};