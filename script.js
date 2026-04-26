const startBtn = document.getElementById('startCapture');
const retakeBtn = document.getElementById('retake');

const startScreen = document.getElementById('startScreen');
const cameraScreen = document.getElementById('cameraScreen');

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

const previewModal = document.getElementById('previewModal');
const previewImg = document.getElementById('previewImg');

const statusText = document.getElementById('statusText');
const targetText = document.getElementById('targetText');

const dot = document.getElementById('dot');
const arrow = document.getElementById('arrow');

const progressEl = document.getElementById('progress');
const downloadBtn = document.getElementById('downloadAll');
const actionBar = document.getElementById('actionBar');

let capturedImages = [];
let captureComplete = false;

let currentYaw = 0;
let currentPitch = 0;

const targets = [0, 45, 90, 135, 180, 225, 270, 315];

const rows = [
    { name: "LOWER", pitch: -75 },
    { name: "BOTTOM_LOW", pitch: -25 },
    { name: "BOTTOM_UP", pitch: 25 },
    { name: "TOP", pitch: 75 }
];

let rowIndex = 0;
let targetIndex = 0;
let capturedFlags = new Array(targets.length).fill(false);

let holding = false;
let holdStart = 0;

const HOLD_TIME = 1000;
const ANGLE_TOL = 8;
const PITCH_TOL = 15;

// CAMERA
async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;
}

// START
startBtn.onclick = async () => {

    previewModal.classList.remove("show");
    previewImg.src = "";
    document.body.classList.remove("modal-open");

    startScreen.classList.add("hidden");
    cameraScreen.classList.remove("hidden");

    gallery.innerHTML = "";
    capturedImages = [];
    captureComplete = false;

    rowIndex = 0;
    targetIndex = 0;
    capturedFlags = new Array(targets.length).fill(false);

    actionBar.classList.add("hidden");

    document.querySelector(".camera-container").style.display = "block";
    window.removeEventListener("deviceorientation", handleOrientation);
    await startCamera();

    window.addEventListener("deviceorientation", handleOrientation);
};

// CAPTURE
function capture() {

    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const imgData = canvas.toDataURL("image/png");

    capturedImages.push(imgData);

    const img = document.createElement("img");
    img.src = imgData;

    gallery.appendChild(img);

    statusText.innerText = `${capturedImages.length} / 32 captured`;
}

// PREVIEW CLICK
gallery.addEventListener("click", (e) => {

    const img = e.target;

    if (img.tagName === "IMG") {
        const index = Array.from(gallery.children).indexOf(img);

        previewImg.src = capturedImages[index];
        previewModal.classList.add("show");
        document.body.classList.add("modal-open");
    }
});

// CLOSE PREVIEW
previewModal.onclick = () => {

    previewModal.classList.remove("show");
    previewImg.src = "";
    document.body.classList.remove("modal-open");
};

// DOT
function updateDot(targetYaw, targetPitch) {

    let yawDiff = currentYaw - targetYaw;
    if (yawDiff > 180) yawDiff -= 360;
    if (yawDiff < -180) yawDiff += 360;

    let pitchDiff = currentPitch - targetPitch;

    dot.style.transform =
        `translate(calc(-50% + ${yawDiff * 2}px), calc(-50% + ${pitchDiff * 2}px))`;

    arrow.innerText = "";
}

// ORIENTATION
function handleOrientation(e) {

    if (captureComplete) return;
    if (e.alpha == null) return;

    currentYaw = (e.alpha + 360) % 360;
    currentPitch = e.beta - 90;

    let row = rows[rowIndex];
    let target = targets[targetIndex];

    if (targetText) {
        targetText.innerText = `${row.name} | ${target}°`;
    }

    updateDot(target, row.pitch);

    if (Math.abs(currentPitch - row.pitch) > PITCH_TOL) {
        holding = false;
        return;
    }

    let diff = Math.abs(currentYaw - target);
    if (diff > 180) diff = 360 - diff;

    if (diff < ANGLE_TOL) {

        if (!holding && !capturedFlags[targetIndex]) {
            holding = true;
            holdStart = Date.now();
        }

        let progress = Math.min((Date.now() - holdStart) / HOLD_TIME, 1);

        progressEl.style.background =
            `conic-gradient(#00c853 ${progress * 360}deg, transparent 0deg)`;

        if (progress >= 1) {

            capture();

            holding = false;

            progressEl.style.background =
                `conic-gradient(#888 0deg, transparent 0deg)`;

            capturedFlags[targetIndex]++;
            targetIndex++;

            if (targetIndex >= targets.length) {
                rowIndex++;
                targetIndex = 0;
                capturedFlags = new Array(targets.length).fill(false);

                if (rowIndex >= rows.length) {
                    finishCapture();
                }
            }
        }

    } else {
        holding = false;
    }
}

// FINISH
function finishCapture() {

    window.removeEventListener('deviceorientation', handleOrientation);

    captureComplete = true;

    document.querySelector(".camera-container").style.display = "none";
    actionBar.classList.remove("hidden");

    statusText.innerText = "✅ Capture complete";
}

// DOWNLOAD
downloadBtn.onclick = async () => {

    const zip = new JSZip();

    capturedImages.forEach((img, i) => {
        zip.file(`img_${i}.png`, img.split(",")[1], { base64: true });
    });

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "photosphere.zip";
    a.click();
};

// RETAKE
retakeBtn.onclick = () => location.reload();