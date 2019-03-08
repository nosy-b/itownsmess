import * as itowns from 'itowns'
import GuiTools from './gui/GuiTools'
import {ToolTip} from './utils/FeatureToolTip'

import binarySearch from './utils/search'
import { createLinks } from './utils/scenario'
import mairies from '../data/mairies'
import scenario from '../data/scenar.js'

import * as THREE from 'three';  // We need THREE (no more exposed by itowns?)


import IGN_MNT_HR from './layers/IGN_MNT_HIGHRES'
import IGN_MNT from './layers/IGN_MNT'
import DARK from './layers/DARK'
import Ortho from './layers/Ortho'
import Slopes from './layers/slopesImage'
import {iso_1_config, iso_5_config} from './layers/isolines'
import iso_1 from './layers/iso_1'
import iso_5 from './layers/iso_5'
import WORLD_DTM from './layers/WORLD_DTM'
import {bati, ShadMatRoof, ShadMatWalls, ShadMatEdges} from './layers/bati'
import {batiRem, ShadMatRoofRem, ShadMatWallsRem, ShadMatEdgesRem} from './layers/bati_remarquable'
import {roads, materialLiness} from './layers/roads'

// around Bordeaux
let positionOnGlobe = { longitude: 2.238, latitude: 48.89, altitude: 350 };
//let coords = { lon: -0.650, lat: 44.905, deltaLon: 0.160, deltaLat: -0.110 };
// île de Ré
//positionOnGlobe = { longitude: -1.3918304443359375, latitude: 46.1865234375, altitude: 80 };
//let coords = { lon: -1.3918304443359375, lat: 46.1865234375, deltaLon: 0.300, deltaLat: -0.150 };

const viewerDiv = document.getElementById('viewerDiv');
const htmlInfo = document.getElementById('info');
const boardInfo = document.getElementById('boardSpace');

// Options for segments in particular is not well handled
// We modified some code in itowns and created an issue https://github.com/iTowns/itowns/issues/910
let options = { segments: 128 }; // We specify a more refined tile geomtry than default 16*16
const globeView = new itowns.GlobeView(viewerDiv, positionOnGlobe, options);
const menuGlobe = new GuiTools('menuDiv', globeView);

var points;
var linesX;
var arrPosGPS = [];

function addtoscene(lines){
    for (let i = 0; i < lines.length; ++i) {
        globeView.scene.add(lines[i]);
    }
}

function adjustAltitude(value) {
    // A.D Here we specify the Z displacement for the water
    var displacement = value;
    globeView.setDisplacementZ(displacement);
    globeView.notifyChange();
}

// Set water representation mode in shaders
function setMode(value) {
    var v = parseInt(value);
    globeView.updateMaterialUniformMode(v);
    globeView.notifyChange();
}

//passing value to the buildings shaders
/*function adjustBuildingColors(value) {
    shadMat.uniforms.waterLevel.value = value;
    shadMatRem.uniforms.waterLevel.value = value;
}*/

function setLinesVisibility(lines, value){
    for(let i = 0; i < lines.length ; ++i) {
        lines[i].visible = (value >= scenario.links[i].hauteur_dysf);
    }
}

//globeView.addLayer(Ortho);
globeView.addLayer(DARK);
globeView.addLayer(WORLD_DTM);
globeView.addLayer(IGN_MNT_HR);
globeView.addLayer(bati);
globeView.addLayer(batiRem);
globeView.addLayer(roads);


const irisLayer = {
    type: 'color',
    id: 'iris',
    name: 'iris',
    transparent: true,
    style: {
        fill: 'orange',
        fillOpacity: 0.01,
        stroke: 'white',
    },
    source: {
        url: 'data/iris.geojson',
        protocol: 'file',
        projection: 'EPSG:4326',
    },
    visible: false
};

globeView.addLayer(irisLayer);


/*************************************** WATER A.D ***********************************************/
// Here we create the Tile geometry for the water using a globe with specific vertex displacement
let object3d = new THREE.Object3D();
let segments = 64;
const globeWater = itowns.createGlobeLayer('globeWater', { object3d, segments });
globeWater.disableSkirt = true;
globeWater.opacity = 0.999; // So we can handle transparency check for nice shading
// We can maybe specify a more refined geometry for the water using segments option
// But as the we represent the water as flat (no wave, ellipsoid like) we can keep a light geomtry
// globe2.noTextureColor = new itowns.THREE.Color(0xd0d5d8);

// add globeWater to the view so it gets updated
itowns.View.prototype.addLayer.call(globeView, globeWater);
//globeWater.addLayer(IGN_MNT_HR);
//itowns.View.prototype.addLayer.call(globeView, IGN_MNT_HR, globeWater);

// UGLY WAY. NEED TO REUSE IGN_MNT_HR  (TODO: check already used ID problem)
// We give the water the information of the ground to make some rendering
// using water height and other stuff
// DONE, we change the ID, it should use the itowns cache so we share the data between globe and water
IGN_MNT_HR.id = 'HR_DTM_forWater';
//itowns.View.prototype.addLayer.call(globeView, IGN_MNT_HR, globeWater);
// Ortho.id = 'Ortho_forWater';
// itowns.View.prototype.addLayer.call(globeView, Ortho, globeWater);
/* itowns.Fetcher.json('src/layers/IGN_MNS_HIGHRES.json').then(function _(litto3D) {
     //worldDTM.id = 'toto';
     itowns.View.prototype.addLayer.call(globeView, litto3D, globeWater);
 });
 */

/*
itowns.Fetcher.json('./layers/JSONLayers/OPENSM.json').then(function _(osm) {
    itowns.View.prototype.addLayer.call(globeView, osm, globeWater);
});
*/



/**************************************************************************************************/

let time = 0;
let currentWaterLevel = { val: 0 };
globeView.addEventListener(itowns.GLOBE_VIEW_EVENTS.GLOBE_INITIALIZED, () => {
    const menuGlobe = new GuiTools('menuDiv', globeView);
    globeView.controls.minDistance = 50;  // Allows the camera to get closer to the ground



// Alex Mod
    animateBuildings();
    loadTraces();
    //createParticles();
/************************************** */




    menuGlobe.addImageryLayersGUI(globeView.getLayers(l => l.type === 'color'));
    menuGlobe.addGeometryLayersGUI(globeView.getLayers(l => l.type === 'geometry' && l.id != 'globe'), ShadMatRoof, ShadMatWalls, ShadMatEdges, ShadMatRoofRem, ShadMatWallsRem, ShadMatEdgesRem);

    menuGlobe.gui.add({wallMode : ShadMatWalls.uniforms.mode.value}, 'wallMode').min(0).max(2).step(1).onChange(
      function updateWallMode(value){
            ShadMatWalls.uniforms.mode.value = value;
            globeView.notifyChange(true);
      }
    );


    menuGlobe.gui.add({roofMode : ShadMatRoof.uniforms.mode.value}, 'roofMode').min(0).max(2).step(1).onChange(
      function updateRoofMode(value){
            ShadMatRoof.uniforms.mode.value = value;
            globeView.notifyChange(true);
      }
    );


    menuGlobe.gui.add({edgesMode : ShadMatEdges.uniforms.mode.value}, 'edgesMode').min(0).max(2).step(1).onChange(
      function updateEdgesMode(value){
            ShadMatEdges.uniforms.mode.value = value;
            globeView.notifyChange(true);
      }
    );


    menuGlobe.gui.add({wallScale : 0.1}, 'wallScale').min(0.01).max(1).onChange(
      function updateScaleWallTexture(value){
            ShadMatWalls.uniforms.texture_scale.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.add({roofScale : 0.1}, 'roofScale').min(0.1).max(1).onChange(
      function updateScaleRoofTexture(value){
            ShadMatRoof.uniforms.texture_scale.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.add({wallOpacity : 1.0}, 'wallOpacity').min(0.1).max(1).onChange(
      function updateOpacityWall(value){
            ShadMatWalls.uniforms.opacity.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.add({roofOpacity : 1.0}, 'roofOpacity').min(0.1).max(1).onChange(
      function updateOpacityRoof(value){
            ShadMatRoof.uniforms.opacity.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.add({edgeOpacity : 1.0}, 'edgeOpacity').min(0.1).max(1).onChange(
      function updateOpacityEdge(value){
            ShadMatEdges.uniforms.opacity.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.addColor({wallColor : ShadMatWalls.uniforms.color.value.getHex()}, 'wallColor').onChange(
      function updateColorWall(value){
            ShadMatWalls.uniforms.color.value = new THREE.Color(value);
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.addColor({roofColor : ShadMatRoof.uniforms.color.value.getHex()}, 'roofColor').onChange(
      function updateColorRoof(value){
            ShadMatRoof.uniforms.color.value = new THREE.Color(value);
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.addColor({edgeColor : ShadMatEdges.uniforms.color.value.getHex()}, 'edgeColor').onChange(
      function updateColorEdge(value){
            ShadMatEdges.uniforms.color.value = new THREE.Color(value);
            globeView.notifyChange(true);
      }
    );

    /* The same as before : controllers which impacts WFS Buidlings Remarquable parameters such as color, texture, opacity, ... */

    menuGlobe.gui.add({wallModeRem : ShadMatWallsRem.uniforms.mode.value}, 'wallModeRem').min(0).max(2).step(1).onChange(
      function updateWallMode(value){
            ShadMatWallsRem.uniforms.mode.value = value;
            globeView.notifyChange(true);
      }
    );


    menuGlobe.gui.add({roofModeRem : ShadMatRoofRem.uniforms.mode.value}, 'roofModeRem').min(0).max(2).step(1).onChange(
      function updateRoofMode(value){
            ShadMatRoofRem.uniforms.mode.value = value;
            globeView.notifyChange(true);
      }
    );


    menuGlobe.gui.add({edgesModeRem : ShadMatEdgesRem.uniforms.mode.value}, 'edgesModeRem').min(0).max(2).step(1).onChange(
      function updateEdgesMode(value){
            ShadMatEdgesRem.uniforms.mode.value = value;
            globeView.notifyChange(true);
      }
    );


    menuGlobe.gui.add({wallScaleRem : 0.1}, 'wallScaleRem').min(0.1).max(1).onChange(
      function updateScaleWallTexture(value){
            ShadMatWallsRem.uniforms.texture_scale.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.add({roofScaleRem : 0.1}, 'roofScaleRem').min(0.1).max(1).onChange(
      function updateScaleRoofTexture(value){
            ShadMatRoofRem.uniforms.texture_scale.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.add({wallOpacityRem : 1.0}, 'wallOpacityRem').min(0.1).max(1).onChange(
      function updateOpacityWall(value){
            ShadMatWallsRem.uniforms.opacity.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.add({roofOpacityRem : 1.0}, 'roofOpacityRem').min(0.1).max(1).onChange(
      function updateOpacityRoof(value){
            ShadMatRoofRem.uniforms.opacity.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.add({edgeOpacityRem : 1.0}, 'edgeOpacityRem').min(0.1).max(1).onChange(
      function updateOpacityEdge(value){
            ShadMatEdgesRem.uniforms.opacity.value = value;
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.addColor({wallColorRem : ShadMatWallsRem.uniforms.color.value.getHex()}, 'wallColorRem').onChange(
      function updateColorWall(value){
            ShadMatWallsRem.uniforms.color.value = new THREE.Color(value);
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.addColor({roofColorRem : ShadMatRoofRem.uniforms.color.value.getHex()}, 'roofColorRem').onChange(
      function updateColorRoof(value){
            ShadMatRoofRem.uniforms.color.value = new THREE.Color(value);
            globeView.notifyChange(true);
      }
    );

    menuGlobe.gui.addColor({edgeColorRem : ShadMatEdgesRem.uniforms.color.value.getHex()}, 'edgeColorRem').onChange(
      function updateColorEdge(value){
            ShadMatEdgesRem.uniforms.color.value = new THREE.Color(value);
            globeView.notifyChange(true);
      }
    );

});


// from itowns examples, can't say I really understand what is going on...
function picking(event) {
    if (globeView.controls.isPaused()) {
        //var htmlInfo = document.getElementById('info');
        var intersects = globeView.pickObjectsAt(event, 10, 'WFS Buildings Remarquable');
        var properties;
        var info;
        htmlInfo.innerHTML = ' ';
        if (intersects.length) {
            var geometry = intersects[0].object.feature.geometry;
            var idPt = (intersects[0].face.a) % (intersects[0].object.feature.vertices.length / 3);
            var id = binarySearch(geometry, idPt);
            properties = geometry[id].properties;

            Object.keys(properties).map(function (objectKey) {
                var value = properties[objectKey];
                var key = objectKey.toString();
                if (key[0] !== '_' && key !== 'geometry_name') {
                    info = value.toString();
                    htmlInfo.innerHTML += '<li><b>' + key + ': </b>' + info + '</li>';
                }
            });
            if (properties['nature'] === 'Mairie') {
                // getting some bullshit info
                let coords = globeView.controls.pickGeoPosition(globeView.eventToViewCoords(event));
                htmlInfo.innerHTML += '<p class="beware">' + mairies[properties['id']]['text'] + '</p>'
            }
        }
    }
}

let legends = [];
legends.push(document.getElementById('greenlegend'));
legends.push(document.getElementById('yellowlegend'));
legends.push(document.getElementById('orangelegend'));
legends.push(document.getElementById('redlegend'));

function changeBoardInfos(value) {
    boardInfo.innerHTML = '';
    let cl = 'bewareNiet';
    legends.forEach(element => { element.className = 'legend'; });
    if (value <= 0.7 ){
        legends[0].className = cl;
    } else if (0.8 <= value && value <= 2) {
        cl = 'bewareYellow';
        legends[1].className = cl;
    } else if (2 < value && value <= 3) {
        cl = 'bewareOrange';
        legends[2].className = cl;
    } else if (value > 3) {
        cl = 'beware';
        legends[3].className = cl;
    }
}

function animateLines() {
    time += 0.02;
    for (let i = 0; i < lines.length ; ++i) {
      lines[i].material.dashSize = lines[i].material.gapSize * (1+time);
    }
    time = time % 2;
    globeView.notifyChange(true);
    requestAnimationFrame(animateLines);
};




// Modification Alex
function animateBuildings(){
  time += 0.01;
  var wallColor = ShadMatWalls.uniforms.color.value.getHex();
  //ShadMatWalls.uniforms.color.value = new THREE.Color(Math.sin(time),Math.cos(time),Math.sin(time));
  ShadMatWalls.uniforms.time.value = time;
  ShadMatRoof.uniforms.time.value = time;
  ShadMatEdges.uniforms.time.value = time;

  materialLiness.uniforms.time.value = time;

  if(arrPosGPS.length > 0){
    var speed = 10;
    var dec = (time * speed) % arrPosGPS.length - Math.floor((time * speed) % arrPosGPS.length);

    var p1 = arrPosGPS[parseInt((time * speed) % arrPosGPS.length)];
    var p2 = arrPosGPS[parseInt(((time * speed) + 1) % arrPosGPS.length)];
    var p = p1.clone().multiplyScalar(1-dec).add(p2.clone().multiplyScalar( dec));
    //var indice = //parseInt((time * 10.) % arrPosGPS.length);
    ShadMatWalls.uniforms.currentPos.value = p;
    ShadMatRoof.uniforms.currentPos.value = p;
    ShadMatEdges.uniforms.currentPos.value = p;

   
  //  console.log(p);
  }

  if(points) {
    points.material.uniforms.time.value = time;
  }
  if(linesX){
     linesX.material.uniforms.time.value = time;
  }
 // console.log(ShadMatWalls.uniforms.color.value, time);
  globeView.notifyChange(true);
  requestAnimationFrame(animateBuildings);
};





function generateSprite() {

  var canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 40;
  var context = canvas.getContext('2d');
  var gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(0,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(0,0,64,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,1)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  var texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}



function createLines(traces){

  var geoObject = JSON.parse(traces);
  var features = [];

  features = geoObject.features;
  var posGPS2 = features[0].geometry.coordinates[0];
  var arrPosGPS2 = [];

  for(var i = 0; i < posGPS2.length; ++i){
    var p = new itowns.Coordinates('EPSG:4326', posGPS2[i][0], posGPS2[i][1],160);
    var c = p.as('EPSG:4978');
    var v = new THREE.Vector3(c._values[0], c._values[1], c._values[2]);
    arrPosGPS2.push(v);
  }

  var particles = 500000;
  var geometryL = new THREE.BufferGeometry();

  var positionsL = [];
  var colors = [];
  var speeds = [];
  var indices = [];

  var n = 10, n2 = n / 2; // particles spread in the cube
  var l = arrPosGPS2.length;
  var nbTraj = 100;

  for ( var i = 0; i < l * 100 ; i++ ) {

    var c  = arrPosGPS2[i % l];
    var c2 = arrPosGPS2[(i + 1) % l];
    positionsL.push( c.x, c.y, c.z );
    positionsL.push( c2.x, c2.y, c2.z );
    speeds.push(Math.random(), Math.random());
    indices.push(i , (i + 1) );
  }

  //console.log(positionsL);
  geometryL.addAttribute( 'position', new THREE.Float32BufferAttribute( positionsL, 3 ) );
  geometryL.addAttribute( 'indice', new THREE.Float32BufferAttribute( indices, 1 ) );
  geometryL.addAttribute( 'speed', new THREE.Float32BufferAttribute( speeds, 1 ) );

  geometryL.computeBoundingSphere();

  // ShaderMaterial Points
  const vertexShaderLiness = `
  #include <logdepthbuf_pars_vertex>
  uniform float time;
  uniform vec3 posGPS[139];
  attribute float speed;
  attribute float indice;
  varying float vDist;
  varying float colTeam;

  vec4 toBezier(float delta, int i, vec4 P0, vec4 P1, vec4 P2, vec4 P3)
  {
      float t = delta * float(i);
      float t2 = t * t;
      float one_minus_t = 1.0 - t;
      float one_minus_t2 = one_minus_t * one_minus_t;
      return (P0 * one_minus_t2 * one_minus_t + P1 * 3.0 * t * one_minus_t2 + P2 * 3.0 * t2 * one_minus_t + P3 * t2 * t);
  }

  void main(){
    
      float t = mod (time * 10., 139.);
      int indiceC = int(t);
      vec3 posInterpolated = mix(posGPS[indiceC], posGPS[indiceC + 1], fract(t) );
      float lineTeam = floor(indice / 139.);
      colTeam = lineTeam / 100.;

      vDist = mod(abs( float(indiceC) - indice + speed * 10.), 139.) + mod(lineTeam,t); // (mod(abs( float(indiceC) - indice + speed * 10.), 139.) - t / 139.) / (speed * 10.) + lineTeam;    // min(50., distance(posInterpolated, position)) / 50.;

      vec3 newPos = position + vec3( cos(speed*time), cos(1. - vDist), sin(1. - vDist) );  // position  * (1. + sin(time * indice) / 1000000.);    // 10. * vec3( cos(speed*time), cos(1. - vDist), sin(1. - vDist) );
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
      
/*

    float t = mod (time * 20., 13900);
    int indiceC = int(t / 100);

    int correspondingCoord = int(indice) / 13900
*/

    #include <logdepthbuf_vertex>
  }
  `;

    
  const fragmentShaderLiness = `
  #include <logdepthbuf_pars_fragment>
  uniform float time;
  varying float vDist;
  varying float colTeam;

  void main(){
    #include <logdepthbuf_fragment>
    gl_FragColor =  vec4(1.,  colTeam, 0., max(1. - vDist, 0.02)); 
  }
  `;


    var  uniformsLiness = {
        posGPS: new THREE.Uniform(arrPosGPS2),       
      //  color: {type: 'c', value: new THREE.Color('white')},      
        time       : {type: 'f', value: time}                      // time to create animation
    };

    var materialLiness = new THREE.ShaderMaterial({
        uniforms: uniformsLiness,
        vertexShader: vertexShaderLiness,
        fragmentShader: fragmentShaderLiness,
        transparent: true,
        opacity: 0.5,
        depthTest: false
    });


  //var material = new THREE.PointsMaterial( { size: 1, vertexColors: THREE.VertexColors, transparent:true, opacity:0.4 } );

  linesX = new THREE.LineSegments( geometryL, materialLiness );
  linesX.frustumCulled = false;
  globeView.scene.add( linesX );
  //console.log("linesX", linesX);

}



function createParticles(traces){

 // console.log(traces);
  var geoObject = JSON.parse(traces);
  var features = [];

  features = geoObject.features;
  //console.log(features);
  var posGPS = features[0].geometry.coordinates[0];
  //console.log(posGPS);
  arrPosGPS = [];

  for(var i = 0; i < posGPS.length; ++i){
    var p = new itowns.Coordinates('EPSG:4326', posGPS[i][0], posGPS[i][1],160);
    var c = p.as('EPSG:4978'); 
    var v = new THREE.Vector3(c._values[0], c._values[1], c._values[2]);
    arrPosGPS.push(v);
  }

 // console.log('arrPosGPS', arrPosGPS);


  var coords = new itowns.Coordinates('EPSG:4326', positionOnGlobe.longitude, positionOnGlobe.latitude, positionOnGlobe.altitude); // Geographic system
  var coordinates = coords.as('EPSG:4978'); 
  //console.log(coordinates);
  var particles = 500000;
  var geometry = new THREE.BufferGeometry();

  var positions = [];
  var colors = [];
  var speeds = [];

  var color = new THREE.Color();

  var n = 10, n2 = n / 2; // particles spread in the cube

  for ( var i = 0; i < particles; i ++ ) {

    // positions
    var beta = 2 * Math.random() * Math.PI;
    var teta = Math.random() * Math.PI;

    var x = n * Math.sin(teta) * Math.cos(beta);
    var y = n * Math.sin(teta) * Math.sin(beta);
    var z = n * Math.cos(teta);

  //  var x = /*coordinates._values[0] +*/ Math.random() * n - n2;
  //  var y = /*coordinates._values[1] +*/ Math.random() * n - n2;
  //  var z = /*coordinates._values[2] +*/ Math.random() * n - n2;

    positions.push( x, y, z );

    // colors

    var vx = ( x / n ) + 0.5;
    var vy = ( y / n ) + 0.5;
    var vz = ( z / n ) + 0.5;

    color.setRGB( vx, vy, vz );

    colors.push( color.r, color.g, color.b );

    speeds.push(Math.random());

  }
  
  geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
  geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
  geometry.addAttribute( 'speed', new THREE.Float32BufferAttribute( speeds, 1 ) );

  geometry.computeBoundingSphere();

  var material = new THREE.PointCloudMaterial({
    color: 0xffffff,
    size: 5,
    transparent: true,
    blending: THREE.AdditiveBlending,
    map: generateSprite()
    });


  // ShaderMaterial Points
  const vertexShaderParticles = `
  #include <logdepthbuf_pars_vertex>
  uniform float time;
  uniform vec3 posGPS[139];
  attribute float speed;
  varying vec3 col;



  //
  // Description : Array and textureless GLSL 2D/3D/4D simplex
  //               noise functions.
  //      Author : Ian McEwan, Ashima Arts.
  //  Maintainer : ijm
  //     Lastmod : 20110822 (ijm)
  //     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
  //               Distributed under the MIT License. See LICENSE file.
  //               https://github.com/ashima/webgl-noise
  //

  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 permute(vec4 x) {
      return mod289(((x*34.0)+1.0)*x);
  }

  vec4 taylorInvSqrt(vec4 r)
  {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  float snoise(vec3 v)
    {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //   x0 = x0 - 0.0 + 0.0 * C.xxx;
    //   x1 = x0 - i1  + 1.0 * C.xxx;
    //   x2 = x0 - i2  + 2.0 * C.xxx;
    //   x3 = x0 - 1.0 + 3.0 * C.xxx;
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
    vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

  // Permutations
    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    float n_ = 0.142857142857; // 1.0/7.0
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
    //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

  // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
    }





  void main(){

    gl_PointSize = 4.;
    float t = mod (time * speed * 10., 139.);

    int indice = int(t);
    vec3 posInterpolated = mix(posGPS[indice], posGPS[indice + 1], fract(t) ) + position * speed * 4.;

/*
    
    int indice = int( mod (t, 139.));
    vec3 posInterpolated = mix(posGPS[indice], posGPS[indice + 1], fract(t) );
    posInterpolated += position * snoise(vec3(t*speed));

*/

/*

    int indice = int( mod(time * 2. * speed + 10. * length(position) + 10. * snoise(position), 139.) );    // int( mod(time * 20. * speed, 139.) );    // int( mod(time * 10., 139.) ); 
    // float distToPos = distance(posGPS[indice], position) / 100.;
    // vec3 posInterpolated = mix((posGPS[indice] + 0.) / 1., (posGPS[indice + 1] + 0.) / 1., fract(time * 2.)  ) + speed * 10. * position;    // mix( posGPS[indice] , posGPS[indice + 1] , fract(time * 2.) ) ; //+ vec3(speed * 10., speed * 10., speed * 10.);
    vec3 posInterpolated = mix((posGPS[indice] + 0.) / 1., (posGPS[indice + 1] + 0.) / 1., fract(time * 2.) + snoise(time * position) );// + 10. * vec3( snoise(vec3(position.x, indice, speed)), speed, cos(speed) ) ;      // + speed * 10. * position; // snoise(position.xyz);
    float noise = snoise(time * position);
    posInterpolated += vec3( cos(noise), sin(noise), noise);
*/
    gl_Position = projectionMatrix * modelViewMatrix * vec4(posInterpolated, 1.0);

    col = vec3(vec2(position/10.), cos(time));

    //float sn = 100. * snoise(gl_Position.xyz);

    //gl_Position.xy += sn;
  
    #include <logdepthbuf_vertex>
  }
  `;

  const fragmentShadeParticles = `
  #include <logdepthbuf_pars_fragment>
  //uniform float opacity;
 // attribute vec3 color;
  uniform float time;
  uniform sampler2D texture;
  varying vec3 col;

  void main(){
    #include <logdepthbuf_fragment>

    gl_FragColor =  mix(texture2D(texture, gl_PointCoord), vec4(col, 0.5), 0.2); //gl_FragCoord); // vec4(color, opacity);
  }
  `;

    let uniformsP = {
        posGPS: new THREE.Uniform(arrPosGPS),
        texture: {type : 'sampler2D', value : generateSprite()},          
      //  color: {type: 'c', value: new THREE.Color('white')},      
        time       : {type: 'f', value: time}                      // time to create animation
    };

    let materialParticles = new THREE.ShaderMaterial({
        uniforms: uniformsP,
        vertexShader: vertexShaderParticles,
        fragmentShader: fragmentShadeParticles,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        //side: THREE.DoubleSide,
       // depthTest: false
    });


  //var material = new THREE.PointsMaterial( { size: 1, vertexColors: THREE.VertexColors, transparent:true, opacity:0.4 } );

  points = new THREE.Points( geometry, materialParticles );
  points.frustumCulled = false;
  points.sortParticles = true;
  var o = new THREE.Object3D();
  globeView.scene.add( points );
  console.log("points", points);

}


function loadJSON(callback) {   

  var xobj = new XMLHttpRequest();
      xobj.overrideMimeType("application/json");
  xobj.open('GET', 'tracks.geojson', true); // Replace 'my_data' with the path to your file
  xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == "200") {
          // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
          callback(xobj.responseText);
        }
  };
  xobj.send(null);  
}


function loadTraces(){

    
  //  loadJSON(createLines);
   // loadJSON(createParticles);
}

