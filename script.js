window.addEventListener("load", () => {

  const startScreen = document.getElementById("startScreen");
  const captureScreen = document.getElementById("captureScreen");
  const resultScreen = document.getElementById("resultScreen");
  const video = document.getElementById("video");
  const dot = document.getElementById("dot");
  const arrow = document.getElementById("arrow");
  const progress = document.getElementById("progress");
  const debug = document.getElementById("debug");
  const statusText = document.getElementById("status");

  const modeButtons =
    document.querySelectorAll(
      ".modeBtn"
    );

  let smoothYaw = 0;
  let smoothPitch = 0;

  let stableYaw = 0;
  let stablePitch = 0;

  let displayYaw = 0;
  let displayPitch = 0;

  let captureCooldown = false;
  let isCapturing = false;

  let worldLockYaw = 0;
  let environmentLocked = false;

  let capturing = false;
  let holding = false;

  let holdStart = 0;

  let stream;

  let currentIndex = 0;

  let capturedImages = [];
  let captureData = [];

  let rings = [];
  let capturePoints = [];
  let totalPoints = 0;

  let cameraFOV = {

    width: 0,
    height: 0,
    aspect: 0,

    horizontal: 58,
    vertical: 50

  };

  function norm360(a) {
    return (a % 360 + 360) % 360;
  }

  function angleDiff(a, b) {
    return ((a - b + 540) % 360) - 180;
  }

  function getPitch(beta) {

    let pitch = beta - 90;

    if (pitch > 90) pitch = 90;
    if (pitch < -90) pitch = -90;

    return pitch;
  }

  function setCaptureMode(mode) {

    capturePoints = [];

    if (mode === "quick") {

      rings = [

        {
          pitch: 0,
          yaws: [
            0, 20, 40, 60,
            80, 100, 120, 140,
            160, 180, 200, 220,
            240, 260, 280, 300,
            320, 340
          ]
        }

      ];

    }

    else if (mode === "standard") {

      rings = [

        {
          pitch: 90,
          yaws: [0]
        },

        {
          pitch: 45,
          yaws: [
            0, 45, 90, 135,
            180, 225, 270, 315
          ]
        },

        {
          pitch: 0,
          yaws: [
            0, 30, 60, 90,
            120, 150, 180, 210,
            240, 270, 300, 330
          ]
        },

        {
          pitch: -45,
          yaws: [
            0, 45, 90, 135,
            180, 225, 270, 315
          ]
        },

        {
          pitch: -90,
          yaws: [0]
        }

      ];

    }

    else if (mode === "pro") {

      rings = [

        {
          pitch: 75,
          yaws: [0, 120, 240]
        },

        {
          pitch: 45,
          yaws: [
            0, 36, 72, 108, 144,
            180, 216, 252, 288, 324
          ]
        },

        {
          pitch: 0,
          yaws: [
            0, 30, 60, 90,
            120, 150, 180, 210,
            240, 270, 300, 330
          ]
        },

        {
          pitch: -45,
          yaws: [
            0, 36, 72, 108, 144,
            180, 216, 252, 288, 324
          ]
        },

        {
          pitch: -75,
          yaws: [60, 180, 300]
        }

      ];

    }

    else {

      rings = [

        {
          pitch: 80,
          yaws: [
            0,
            90,
            180,
            270
          ]
        },

        {
          pitch: 50,
          yaws: [
            0,
            30,
            60,
            90,
            120,
            150,
            180,
            210,
            240,
            270,
            300,
            330
          ]
        },

        {
          pitch: 20,
          yaws: [
            0,
            25,
            50,
            75,
            100,
            125,
            150,
            175,
            200,
            225,
            250,
            275,
            300,
            325
          ]
        },

        {
          pitch: -20,
          yaws: [
            12,
            42,
            72,
            102,
            132,
            162,
            192,
            222,
            252,
            282,
            312,
            342
          ]
        },

        {
          pitch: -75,
          yaws: [
            45,
            135,
            225,
            315
          ]
        }

      ];

    }

    rings.forEach(r => {

      r.yaws.forEach(yaw => {

        capturePoints.push({

          yaw,
          pitch: r.pitch

        });

      });

    });

    totalPoints =
      capturePoints.length;

  }

  modeButtons.forEach(btn => {

    btn.onclick = async () => {

      setCaptureMode(
        btn.dataset.mode
      );

      try {

        startScreen.style.display =
          "none";

        captureScreen.style.display =
          "block";

        if (
          typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function"
        ) {

          await DeviceOrientationEvent
            .requestPermission();

        }

        stream =
          await navigator.mediaDevices
            .getUserMedia({

              video: {
                facingMode: {
                  ideal: "environment"
                },
                width: {
                  ideal: 1920
                },
                height: {
                  ideal: 1080
                }
              }

            });

        video.srcObject = stream;

        await video.play();

        cameraFOV.width =
          video.videoWidth;

        cameraFOV.height =
          video.videoHeight;

        cameraFOV.aspect =
          video.videoWidth /
          video.videoHeight;

        capturing = true;

      } catch (err) {

        debug.innerHTML =
          err;

      }

    };

  });

  window.addEventListener(
    "deviceorientation",
    async e => {

      if (!capturing) return;

      if (
        captureCooldown ||
        isCapturing
      ) {
        return;
      }

      let rawYaw =
        360 - e.alpha;

      let rawPitch =
        getPitch(
          e.beta || 0
        );

      if (!environmentLocked) {

        worldLockYaw =
          rawYaw;

        environmentLocked = true;
      }

      let yaw =
        norm360(
          rawYaw - worldLockYaw
        );

      smoothYaw =
        norm360(

          smoothYaw +

          angleDiff(
            yaw,
            smoothYaw
          ) * 0.14

        );

      smoothPitch +=
        (rawPitch - smoothPitch) * 0.2;

      stableYaw =
        norm360(

          stableYaw +

          angleDiff(
            smoothYaw,
            stableYaw
          ) * 0.35

        );

      stablePitch +=
        (smoothPitch - stablePitch) * 0.35;

      displayYaw =
        norm360(

          displayYaw +

          angleDiff(
            stableYaw,
            displayYaw
          ) * 0.55

        );

      displayPitch +=
        (stablePitch - displayPitch) * 0.55;

      const active =
        capturePoints[currentIndex];

      if (!active) {

        finish();
        return;
      }

      let yawDiff =
        angleDiff(
          stableYaw,
          active.yaw
        );

      let pitchDiff =
        active.pitch -
        stablePitch;

      let visualYaw =
        angleDiff(
          displayYaw,
          active.yaw
        );

      let visualPitch =
        active.pitch -
        displayPitch;

      dot.style.transform =
        `
translate(
calc(-50% + ${-(visualYaw / 18) * 70}px),
calc(-50% + ${(visualPitch / 18) * 70}px)
)
`;

      if (
        Math.abs(yawDiff) >
        Math.abs(pitchDiff)
      ) {

        arrow.innerText =
          yawDiff > 0 ? "⬅" : "➡";

      } else {

        arrow.innerText =
          pitchDiff > 0 ? "⬆" : "⬇";
      }

      statusText.innerHTML =
        `
Captured
${capturedImages.length}
/
${totalPoints}
`;

      const aligned =

        Math.abs(yawDiff) < 10 &&
        Math.abs(pitchDiff) < 10;

      if (aligned) {

        if (!holding) {

          holding = true;
          holdStart = Date.now();

        }

        let progressValue =
          (Date.now() - holdStart) / 500;

        progress.style.background =
          `
conic-gradient(
lime ${progressValue * 360}deg,
transparent 0deg
)
`;

        if (progressValue >= 1) {

          isCapturing = true;
          captureCooldown = true;

          await capture(active);

          currentIndex++;

          holding = false;

          progress.style.background =
            "none";

          await new Promise(r =>
            setTimeout(r, 550)
          );

          captureCooldown = false;
          isCapturing = false;
        }

      } else {

        holding = false;

        progress.style.background =
          "none";
      }

      debug.innerHTML =
        `
Mode:
${capturePoints.length} Points

<br><br>

Captured:
${capturedImages.length}
/
${totalPoints}

<br><br>

Yaw:
${stableYaw.toFixed(1)}

<br>

Pitch:
${stablePitch.toFixed(1)}

<br><br>

Target Yaw:
${active.yaw}

<br>

Target Pitch:
${active.pitch}

<br><br>

Yaw Diff:
${yawDiff.toFixed(1)}

<br>

Pitch Diff:
${pitchDiff.toFixed(1)}
`;

    });

  async function capture(active) {

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const ctx =
      canvas.getContext("2d");

    ctx.drawImage(
      video,
      0,
      0
    );

    const img =
      canvas.toDataURL(
        "image/png"
      );

    capturedImages.push(img);

    captureData.push({

      file:
        `img_${capturedImages.length}.png`,

      yaw:
        stableYaw,

      pitch:
        stablePitch,

      targetYaw:
        active.yaw,

      targetPitch:
        active.pitch,

      camera:
        cameraFOV,

      timestamp:
        Date.now()

    });

  }

  function finish() {

    capturing = false;

    if (stream) {

      stream.getTracks()
        .forEach(track => {

          track.stop();

        });

    }

    captureScreen.style.display =
      "none";

    resultScreen.style.display =
      "block";

    const gallery =
      document.getElementById(
        "gallery"
      );

    capturedImages.forEach(img => {

      const el =
        document.createElement("img");

      el.src = img;

      gallery.appendChild(el);

    });

  }

  document.getElementById(
    "downloadBtn"
  ).onclick = async () => {

    const zip =
      new JSZip();

    capturedImages.forEach((img, i) => {

      zip.file(

        `img_${i + 1}.png`,

        img.split(",")[1],

        {
          base64: true
        }

      );

    });

    zip.file(

      "data.json",

      JSON.stringify({

        camera:
          cameraFOV,

        images:
          captureData

      },
        null,
        2)

    );

    const blob =
      await zip.generateAsync({

        type: "blob"

      });

    const a =
      document.createElement("a");

    a.href =
      URL.createObjectURL(blob);

    a.download =
      "360_capture.zip";

    a.click();

  };

});