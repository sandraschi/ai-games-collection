// Where is Benny? — hide-and-seek in the Kaffeehaus room. Three r128, Raycaster, no physics.
// Reuses kaffeehaus room layout so both games share assets.
let scene, camera, renderer, controls, benny, finds = 0, clicks = 0;
const spots = [[1.5,0.35,1.2],[-1.5,0.35,-1.2],[0,0.35,0],[1.5,0.35,-1.2],[-1.5,0.35,1.2]];

function init(){
  const canvas = document.getElementById('benny3D');
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1410);
  camera = new THREE.PerspectiveCamera(55, innerWidth/(innerHeight-53), 0.1, 100);
  camera.position.set(0, 2.5, 4.5);
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setSize(innerWidth, innerHeight-53);
  renderer.shadowMap.enabled = true;
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.6, 0);

  scene.add(new THREE.AmbientLight(0xffe0b3, 0.6));
  const lamp = new THREE.PointLight(0xffc873, 1.1, 12); lamp.position.set(0,3,0); scene.add(lamp);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10,10), new THREE.MeshLambertMaterial({ color:0x4a3428 }));
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);

  // Benny = brown dachshund-ish capsule (placeholder for Nekomimi VRM on avatar-viewer page)
  const mat = new THREE.MeshLambertMaterial({ color:0x8B5A2B });
  benny = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.12, 0.35, 4, 8) : new THREE.SphereGeometry(0.15, 12, 10), mat);
  body.rotation.z = Math.PI/2; body.castShadow = true; benny.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat);
  head.position.set(0.28, 0.08, 0); benny.add(head);
  scene.add(benny);
  hideBenny();
  renderer.domElement.addEventListener('click', onClick);
  addEventListener('resize', ()=>{ camera.aspect = innerWidth/(innerHeight-53); camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight-53); });
  animate();
}
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function onClick(e){
  clicks++; document.getElementById('clicks').textContent = clicks;
  ptr.x = (e.clientX/innerWidth)*2-1; ptr.y = -(e.clientY/(innerHeight-53))*2+1;
  ray.setFromCamera(ptr, camera);
  if(ray.intersectObject(benny, true).length){
    finds++; document.getElementById('finds').textContent = finds;
    document.getElementById('status').textContent = 'Gefunden! Benny bellt. (' + finds + 'x)';
    if(window.gameStats) gameStats.record('where-is-benny','found',clicks);
    setTimeout(hideBenny, 1200);
  }
}
function hideBenny(){
  const s = spots[Math.floor(Math.random()*spots.length)];
  benny.position.set(s[0], s[1], s[2]);
  benny.rotation.y = Math.random()*Math.PI*2;
  document.getElementById('status').textContent = 'Benny versteckt… such ihn!';
}
function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
window.hideBenny = hideBenny;
document.addEventListener('DOMContentLoaded', init);
