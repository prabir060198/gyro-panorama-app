const startBtn = document.getElementById("startBtn");
const captureBtn = document.getElementById("captureBtn");
const gyroMsg = document.getElementById("gyroMsg");

const startScreen = document.getElementById("startScreen");
const cameraScreen = document.getElementById("cameraScreen");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const dot = document.getElementById("dot");
const arrow = document.getElementById("arrow");

const gallery = document.getElementById("gallery");
const status = document.getElementById("status");

const actionBar = document.getElementById("actionBar");
const downloadBtn = document.getElementById("downloadBtn");
const retakeBtn = document.getElementById("retakeBtn");

let capturing = false;
let capturedImages = [];
let captureData = [];

let currentYaw = 0;
let currentPitch = 0;

// ROW STRUCTURE
const rows = [
    { name: "TOP", pitch: -80, count: 2 },
    { name: "UPPER", pitch: -40, count: 8 },
    { name: "MIDDLE", pitch: 0, count: 12 },
    { name: "LOWER", pitch: 40, count: 8 },
    { name: "BOTTOM", pitch: 80, count: 2 }
];

let rowIndex = 0;
let targets = [];
let targetIndex = 0;

const HFOV = 70;
const OVERLAP = 0.3;

function generateTargets(row) {
    const pitchRad = row.pitch * Math.PI / 180;
    const effectiveFOV = HFOV * Math.cos(pitchRad);
    const step = effectiveFOV * (1 - OVERLAP);

    let arr = [];
    let angle = 0;

    while (angle < 360) {
        arr.push(angle);
        angle += step;
    }

    return arr;
}

// GYRO CHECK
startBtn.onclick = async () => {
    if (!window.DeviceOrientationEvent) {
        gyroMsg.innerText = "❌ Gyroscope not supported";
        return;
    }

    startScreen.classList.add("hidden");
    cameraScreen.classList.remove("hidden");

    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
};

// START CAPTURE
captureBtn.onclick = () => {
    capturing = true;
    captureBtn.style.display = "none";

    targets = generateTargets(rows[rowIndex]);
    window.addEventListener("deviceorientation", handleOrientation);
};

// ORIENTATION
function handleOrientation(e) {
    if (!capturing) return;

    currentYaw = (e.alpha + 360) % 360;
    currentPitch = e.beta - 90;

    const targetYaw = targets[targetIndex];
    const targetPitch = rows[rowIndex].pitch;

    // DOT MOVEMENT
    let dx = currentYaw - targetYaw;
    let dy = currentPitch - targetPitch;

    dot.style.transform = `translate(${dx * 2}px, ${dy * 2}px)`;

    // ARROW DIRECTION
    if (Math.abs(dx) > 10) {
        arrow.innerText = dx > 0 ? "⬅" : "➡";
    } else if (Math.abs(dy) > 10) {
        arrow.innerText = dy > 0 ? "⬆" : "⬇";
    } else {
        arrow.innerText = "✔";
        capture();
    }

    status.innerText = `${capturedImages.length}/32`;
}

// CAPTURE
function capture() {

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const img = canvas.toDataURL("image/png");

    const name = `img_${capturedImages.length}.png`;

    capturedImages.push(img);

    captureData.push({
        name,
        yaw: currentYaw,
        pitch: currentPitch,
        row: rows[rowIndex].name
    });

    const im = document.createElement("img");
    im.src = img;
    gallery.appendChild(im);

    targetIndex++;

    if (targetIndex >= targets.length) {
        rowIndex++;

        if (rowIndex >= rows.length) {
            finish();
            return;
        }

        targets = generateTargets(rows[rowIndex]);
        targetIndex = 0;
    }
}

// FINISH
function finish() {
    capturing = false;
    window.removeEventListener("deviceorientation", handleOrientation);

    status.innerText = "✅ Done";
    actionBar.classList.remove("hidden");
}

// DOWNLOAD
downloadBtn.onclick = async () => {
    const zip = new JSZip();

    capturedImages.forEach((img, i) => {
        zip.file(`img_${i}.png`, img.split(",")[1], { base64: true });
    });

    zip.file("metadata.json", JSON.stringify(captureData, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "photosphere.zip";
    a.click();
};

// RETAKE
retakeBtn.onclick = () => location.reload();