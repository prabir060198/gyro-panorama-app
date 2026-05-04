window.addEventListener("load", () => {

  const canvas = document.getElementById("renderCanvas");
  const video = document.getElementById("video");
  const ghost = document.getElementById("targetGhost");
  const progressCircle = document.getElementById("progressCircle");
  const debugBox = document.getElementById("debugBox");

  let engine, scene, camera;

  let yawOffset = null;
  let capturing = false;

  let smoothYaw = 0;
  let smoothPitch = 0;

  let ringIndex = 0;
  let targetIndex = 0;

  let holding = false;
  let holdStart = 0;

  let guidePoints = [];

  const rings = [
    { pitch: 75,  yaws: [0,180] },
    { pitch: 45,  yaws: [0,45,90,135,180,225,270,315] },
    { pitch: 0,   yaws: [0,30,60,90,120,150,180,210,240,270,300,330] },
    { pitch: -45, yaws: [0,45,90,135,180,225,270,315] },
    { pitch: -75, yaws: [90,270] }
  ];

  function init3D() {
    engine = new BABYLON.Engine(canvas, true);
    engine.setHardwareScalingLevel(1 / window.devicePixelRatio);

    scene = new BABYLON.Scene(engine);

    camera = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

    new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

    const sphere = BABYLON.MeshBuilder.CreateSphere("s", {diameter:6}, scene);
    const mat = new BABYLON.StandardMaterial("m", scene);
    mat.wireframe = true;
    mat.alpha = 0.3;
    sphere.material = mat;

    createPoints();

    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
  }

  function spherical(yaw, pitch) {
    const y = BABYLON.Tools.ToRadians(yaw);
    const p = BABYLON.Tools.ToRadians(pitch);

    return new BABYLON.Vector3(
      Math.sin(y)*Math.cos(p),
      Math.sin(p),
      Math.cos(y)*Math.cos(p)
    ).scale(3);
  }

  function createPoints() {
    rings.forEach((r, ri) => {
      r.yaws.forEach((y, yi) => {
        const mesh = BABYLON.MeshBuilder.CreateSphere("p",{diameter:0.15},scene);
        mesh.position = spherical(y, r.pitch);

        const m = new BABYLON.StandardMaterial("m", scene);
        m.emissiveColor = new BABYLON.Color3(1,1,1);
        mesh.material = m;

        guidePoints.push({mesh, ri, yi, done:false});
      });
    });
  }

  function project(pos) {
    const p = BABYLON.Vector3.Project(
      pos,
      BABYLON.Matrix.Identity(),
      scene.getTransformMatrix(),
      camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    );
    return {x:p.x,y:p.y};
  }

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

  window.addEventListener("deviceorientation", e => {

    if (!camera || !capturing || e.alpha == null) return;

    let yaw = (e.alpha + 360) % 360;
    let pitch = -(e.beta - 90);

    pitch = Math.max(-90, Math.min(90, pitch));

    if (yawOffset === null) yawOffset = yaw;
    yaw = (yaw - yawOffset + 360) % 360;

    smoothYaw = smoothYaw * 0.9 + yaw * 0.1;
    smoothPitch = smoothPitch * 0.9 + pitch * 0.1;

    camera.rotation.y = BABYLON.Tools.ToRadians(smoothYaw);
    camera.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

    const active = guidePoints.find(g =>
      g.ri === ringIndex && g.yi === targetIndex
    );

    if (!active) return;

    const screen = project(active.mesh.position);

    ghost.style.left = screen.x + "px";
    ghost.style.top = screen.y + "px";

    const cx = engine.getRenderWidth()/2;
    const cy = engine.getRenderHeight()/2;

    const dx = screen.x - cx;
    const dy = screen.y - cy;

    const aligned = Math.abs(dx)<25 && Math.abs(dy)<25;

    if (aligned) {

      if (!holding) {
        holding = true;
        holdStart = Date.now();
      }

      let progress = (Date.now()-holdStart)/700;

      progressCircle.style.background =
        `conic-gradient(lime ${progress*360}deg, transparent 0deg)`;

      if (progress>=1) {

        active.done = true;

        targetIndex++;
        if (targetIndex>=rings[ringIndex].yaws.length){
          ringIndex++;
          targetIndex=0;
        }

        holding=false;
        progressCircle.style.background="none";
      }

    } else {
      holding=false;
      progressCircle.style.background="none";
    }

    guidePoints.forEach(g=>{
      if(g.done){
        g.mesh.material.emissiveColor = new BABYLON.Color3(0,1,0);
      } else if(g===active){
        g.mesh.material.emissiveColor = new BABYLON.Color3(1,0.5,0);
      } else {
        g.mesh.material.emissiveColor = new BABYLON.Color3(1,1,1);
      }
    });

    debugBox.innerHTML =
      `Yaw:${smoothYaw.toFixed(1)}<br>
       Pitch:${smoothPitch.toFixed(1)}<br>
       dx:${dx.toFixed(1)} dy:${dy.toFixed(1)}<br>
       aligned:${aligned}`;
  });

});