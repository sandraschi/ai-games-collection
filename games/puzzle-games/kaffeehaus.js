// Kaffeehaus — Vienna cafe, Three.js r128 orbit, no physics.
// Mirrors to gamesapp/games/puzzle-games/kaffeehaus.js 1:1.
let scene, camera, renderer, controls, tables = [];
let orders = 0;

function init(){
  const canvas = document.getElementById('kaffee3D');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1410);
  scene.fog = new THREE.Fog(0x1a1410, 8, 22);
  camera = new THREE.PerspectiveCamera(50, innerWidth/(innerHeight-120), 0.1, 100);
  camera.position.set(4, 3.5, 5);
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setSize(innerWidth, innerHeight-120);
  renderer.shadowMap.enabled = true;
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, 0); controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffe0b3, 0.5));
  const chandelier = new THREE.PointLight(0xffc873, 1.2, 12); chandelier.position.set(0,3,0); scene.add(chandelier);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12,12), new THREE.MeshLambertMaterial({ color:0x4a3428 }));
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);

  const wood = new THREE.MeshLambertMaterial({ color:0x6b4423 });
  const marble = new THREE.MeshLambertMaterial({ color:0xe8e0d0 });
  for(let i=0;i<4;i++){
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.05,16), marble);
    top.position.y = 0.75; top.castShadow = true; g.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.75,8), wood);
    leg.position.y = 0.37; g.add(leg);
    const x = (i%2? 1.5 : -1.5), z = (i<2? 1.2 : -1.2);
    g.position.set(x, 0, z); g.userData.tableId = i;
    scene.add(g); tables.push(g);
  }
  renderer.domElement.addEventListener('click', onClick);
  addEventListener('resize', ()=>{ camera.aspect = innerWidth/(innerHeight-120); camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight-120); });
  animate();
}
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function onClick(e){
  ptr.x = (e.clientX/innerWidth)*2-1; ptr.y = -(e.clientY/(innerHeight-120))*2+1;
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(tables, true);
  if(hits.length){ serveMelange(); }
}
function serveMelange(){
  orders++;
  document.getElementById('orders').textContent = orders;
  document.getElementById('status').textContent = 'Melange #' + orders + ' serviert!';
  if(window.gameStats) gameStats.record('kaffeehaus','serve',1);
  if(window.gameAssetLoader) gameAssetLoader.preloadGameAssets('where-is-benny');
}
function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
window.serveMelange = serveMelange;
document.addEventListener('DOMContentLoaded', init);
