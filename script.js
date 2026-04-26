const startBtn = document.getElementById('startCapture');
const retakeBtn = document.getElementById('retake');

const startScreen = document.getElementById('startScreen');
const cameraScreen = document.getElementById('cameraScreen');
const resultScreen = document.getElementById('resultScreen');

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

const previewModal = document.getElementById('previewModal');
const previewImg = document.getElementById('previewImg');

const statusText = document.getElementById('statusText');
const targetText = document.getElementById('targetText');

const dot = document.getElementById('dot');
const arrow = document.getElementById('arrow');

const downloadBtn = document.getElementById('downloadAll');

let capturedImages = [];

let currentYaw = 0;
let currentPitch = 0;

const targets = [0,45,90,135,180,225,270,315];

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
    startScreen.classList.add("hidden");
    cameraScreen.classList.remove("hidden");

    await startCamera();

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        let res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return;
    }

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

    // SHOW thumbnail live
    const img = document.createElement("img");
    img.src = imgData;
    gallery.appendChild(img);

    statusText.innerText = `${capturedImages.length} / 32 captured`;
}

// DOT + ARROW
function updateDot(targetYaw, targetPitch) {

    let yawDiff = currentYaw - targetYaw;
    if (yawDiff > 180) yawDiff -= 360;
    if (yawDiff < -180) yawDiff += 360;

    let pitchDiff = currentPitch - targetPitch;

    let x = yawDiff * 2;
    let y = pitchDiff * 2;

    dot.style.transform =
        `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    let arrowText = "";

    if (Math.abs(yawDiff) > ANGLE_TOL) {
        arrowText += yawDiff > 0 ? "➡ " : "⬅ ";
    }

    if (Math.abs(pitchDiff) > PITCH_TOL) {
        arrowText += pitchDiff > 0 ? "⬇" : "⬆";
    }

    arrow.innerText = arrowText;
}

// ORIENTATION
function handleOrientation(e) {

    if (e.alpha == null) return;

    currentYaw = (e.alpha + 360) % 360;
    currentPitch = e.beta - 90;

    let row = rows[rowIndex];
    let target = targets[targetIndex];

    targetText.innerText = `${row.name} | ${target}°`;

    updateDot(target, row.pitch);

    if (Math.abs(currentPitch - row.pitch) > PITCH_TOL) {
        holding = false;
        statusText.innerText = "Adjust tilt";
        return;
    }

    let diff = Math.abs(currentYaw - target);
    if (diff > 180) diff = 360 - diff;

    if (diff < ANGLE_TOL) {

        statusText.innerText = "Hold steady...";

        if (!holding && !capturedFlags[targetIndex]) {
            holding = true;
            holdStart = Date.now();
        }

        let progress = Math.min((Date.now() - holdStart)/HOLD_TIME,1);

        if (progress >= 1) {

            capture();

            holding = false;

            capturedFlags[targetIndex] = true;
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
        statusText.innerText = "Follow arrows";
    }
}

// FINISH
function finishCapture() {

    window.removeEventListener('deviceorientation', handleOrientation);

    // enable preview click now
    const imgs = gallery.querySelectorAll("img");

    imgs.forEach((img, i) => {
        img.onclick = () => {
            previewModal.style.display = "flex";
            previewImg.src = capturedImages[i];
        };
    });

    cameraScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");
}

// PREVIEW CLOSE
previewModal.onclick = () => {
    previewModal.style.display = "none";
};

// DOWNLOAD ZIP
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