window.addEventListener("load", () => {

  const canvas = document.getElementById("renderCanvas");
  const video = document.getElementById("video");
  const startBtn = document.getElementById("startBtn");
  const captureBtn = document.getElementById("captureBtn");

  let engine, scene, camera;

  let currentYaw = 0;
  let currentPitch = 0;
  let yawOffset = null;

  let capturing = false;

  // ===== INIT 3D =====
  function init3D() {

    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);

    camera = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

    new BABYLON.HemisphericLight("light",
      new BABYLON.Vector3(0,1,0), scene);

    const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {
      diameter: 6,
      segments: 32
    }, scene);

    const mat = new BABYLON.StandardMaterial("mat", scene);
    mat.wireframe = true;
    mat.alpha = 0.3;
    sphere.material = mat;

    engine.runRenderLoop(() => {
      scene.render();
    });

    window.addEventListener("resize", () => engine.resize());
  }

  // ===== START CAMERA =====
  startBtn.onclick = async () => {
    try {

      // iPhone permission
      if (typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function") {
        await DeviceOrientationEvent.requestPermission();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      video.srcObject = stream;
      await video.play();

      init3D();

    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // ===== START CAPTURE =====
  captureBtn.onclick = () => {
    capturing = true;
    yawOffset = null;
  };

  // ===== ORIENTATION =====
  window.addEventListener("deviceorientation", (e) => {

    if (!camera || !capturing || e.alpha == null) return;

    let yaw = (e.alpha + 360) % 360;

    // 🔥 FIXED PITCH (stable)
    let pitch = e.beta - 90;
    pitch = -pitch;
    pitch = Math.max(-90, Math.min(90, pitch));

    // yaw offset
    if (yawOffset === null) yawOffset = yaw;
    yaw = (yaw - yawOffset + 360) % 360;

    // smoothing
    currentYaw = currentYaw * 0.85 + yaw * 0.15;
    currentPitch = currentPitch * 0.85 + pitch * 0.15;

    // apply rotation
    camera.rotation.y = BABYLON.Tools.ToRadians(currentYaw);
    camera.rotation.x = BABYLON.Tools.ToRadians(currentPitch);

  });

});