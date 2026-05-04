window.addEventListener("load", () => {

  const canvas = document.getElementById("renderCanvas");
  const video = document.getElementById("video");

  let engine, scene, camera;

  let yaw = 0;
  let pitch = 0;
  let yawOffset = null;

  let smoothYaw = 0;
  let smoothPitch = 0;

  let capturing = false;

  // ===== INIT =====
  function init3D() {

    engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });

    // 🔥 IMPORTANT for full screen
    engine.setHardwareScalingLevel(1 / window.devicePixelRatio);

    scene = new BABYLON.Scene(engine);

    camera = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

    new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

    const sphere = BABYLON.MeshBuilder.CreateSphere("s", {diameter:6}, scene);

    const mat = new BABYLON.StandardMaterial("m", scene);
    mat.wireframe = true;
    mat.alpha = 0.3;
    sphere.material = mat;

    engine.runRenderLoop(() => {
      scene.render();
    });

    window.addEventListener("resize", () => engine.resize());
  }

  // ===== START =====
  startBtn.onclick = async () => {

    if (DeviceOrientationEvent.requestPermission) {
      await DeviceOrientationEvent.requestPermission();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });

    video.srcObject = stream;
    await video.play();

    init3D();
  };

  captureBtn.onclick = () => {
    capturing = true;
    yawOffset = null;
  };

  // ===== STABLE FILTER =====
  function smoothFilter(prev, current) {
    const alpha = 0.08; // smaller = smoother
    return prev * (1 - alpha) + current * alpha;
  }

  function deadzone(v, t = 0.2) {
    return Math.abs(v) < t ? 0 : v;
  }

  // ===== ORIENTATION =====
  window.addEventListener("deviceorientation", (e) => {

    if (!camera || !capturing || e.alpha == null) return;

    let rawYaw = (e.alpha + 360) % 360;
    let rawPitch = -(e.beta - 90);

    rawPitch = Math.max(-90, Math.min(90, rawPitch));

    if (yawOffset === null) yawOffset = rawYaw;

    rawYaw = (rawYaw - yawOffset + 360) % 360;

    // 🔥 APPLY DEADZONE
    rawYaw = deadzone(rawYaw, 0.05);
    rawPitch = deadzone(rawPitch, 0.05);

    // 🔥 SMOOTH
    smoothYaw = smoothFilter(smoothYaw, rawYaw);
    smoothPitch = smoothFilter(smoothPitch, rawPitch);

    // 🔥 APPLY
    camera.rotation.y = BABYLON.Tools.ToRadians(smoothYaw);
    camera.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

  });

});