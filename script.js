const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const preview = document.getElementById('preview');
const gallery = document.getElementById('gallery');

const startBtn = document.getElementById('startBtn');
const captureBtn = document.getElementById('captureBtn');

let stream = null;

// Start Camera
startBtn.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        video.srcObject = stream;
    } catch (err) {
        alert("Camera not working: " + err.message);
    }
});

// Capture Photo
captureBtn.addEventListener('click', () => {
    if (!stream) {
        alert("Start camera first!");
        return;
    }

    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL("image/png");

    // Preview
    preview.innerHTML = `
        <h3>Preview</h3>
        <img src="${imageData}" width="200"/>
        <br>
        <a href="${imageData}" download="photo.png">
            <button>Download</button>
        </a>
    `;

    // Add to gallery
    const img = document.createElement("img");
    img.src = imageData;
    gallery.appendChild(img);
});