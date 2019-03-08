import * as itowns from 'itowns';

import * as THREE from 'three';
import { getColor } from './color';
//import Feature2Mesh from './Feature2Mesh';

import GlobeView from 'itowns/lib/Core/Prefab/GlobeView';


function getProperty(name, options, defaultValue, ...args) {
    const property = options[name];

    if (property) {
        if (typeof property === 'function') {
            const p = property(...args);
            if (p) {
                return p;
            }
        } else {
            return property;
        }
    }

    if (typeof defaultValue === 'function') {
        return defaultValue(...args);
    }

    return defaultValue;
}

function randomColor() {
    return new THREE.Color(Math.random() * 0xffffff);
}

function fillColorArray(colors, length, color, offset = 0) {
    offset *= 3;
    const len = offset + length * 3;
    for (let i = offset; i < len; i += 3) {
        colors[i] = color.r * 255;
        colors[i + 1] = color.g * 255;
        colors[i + 2] = color.b * 255;
    }
}


/**
 * Convert coordinates to vertices positionned at a given altitude
 *
 * @param      {number[]} ptsIn - Coordinates of a feature.
 * @param      {number[]} normals - Coordinates of a feature.
 * @param      {number[]} target - Target to copy result.
 * @param      {(Function|number)}  altitude - Altitude of feature or function to get altitude.
 * @param      {number} extrude - The extrude amount to apply at each point
 * @param      {number} offsetOut - The offset array value to copy on target
 * @param      {number} countIn - The count of coordinates to read in ptsIn
 * @param      {number} startIn - The offser array to strat reading in ptsIn
 */

const coord = new itowns.Coordinates('EPSG:4326', 0, 0);
function coordinatesToVertices(ptsIn, normals, target, altitude = 0, extrude = 0, offsetOut = 0, countIn = ptsIn.length / 3, startIn = offsetOut) {
    startIn *= 3;
    countIn *= 3;
    offsetOut *= 3;
    const endIn = startIn + countIn;
    let fnAltitude;
    if (!isNaN(altitude)) {
        fnAltitude = () => altitude;
    } else if (Array.isArray(altitude)) {
        fnAltitude = id => altitude[(id - startIn) / 3];
    } else {
        fnAltitude = id => altitude({}, coord.set(ptsIn.crs, ptsIn[id], ptsIn[id + 1], ptsIn[id + 2]));
    }

    for (let i = startIn, j = offsetOut; i < endIn; i += 3, j += 3) {
        // move the vertex following the normal, to put the point on the good altitude
        const t = fnAltitude(i) + (Array.isArray(extrude) ? extrude[(i - startIn) / 3] : extrude);
        if (target.minAltitude) {
            target.minAltitude = Math.min(t, target.minAltitude);
        }
        // fill the vertices array at the offset position
        target[j] = ptsIn[i] + normals[i] * t;
        target[j + 1] = ptsIn[i + 1] + normals[i + 1] * t;
        target[j + 2] = ptsIn[i + 2] + normals[i + 2] * t;
    }
}




  // ShaderMaterial Points
  const vertexShaderLiness = `
  #include <logdepthbuf_pars_vertex>
  uniform float time;
 // uniform vec3 posGPS[139];
 // attribute float speed;
 // attribute float indice;
 // varying float vDist;
 // varying float colTeam;

  vec4 toBezier(float delta, int i, vec4 P0, vec4 P1, vec4 P2, vec4 P3)
  {
      float t = delta * float(i);
      float t2 = t * t;
      float one_minus_t = 1.0 - t;
      float one_minus_t2 = one_minus_t * one_minus_t;
      return (P0 * one_minus_t2 * one_minus_t + P1 * 3.0 * t * one_minus_t2 + P2 * 3.0 * t2 * one_minus_t + P3 * t2 * t);
  }

  void main(){
    
    /*
      float t = mod (time * 10., 139.);
      int indiceC = int(t);
      vec3 posInterpolated = mix(posGPS[indiceC], posGPS[indiceC + 1], fract(t) );
      float lineTeam = floor(indice / 139.);
      colTeam = lineTeam / 100.;

      vDist = mod(abs( float(indiceC) - indice + speed * 10.), 139.) + mod(lineTeam,t); // (mod(abs( float(indiceC) - indice + speed * 10.), 139.) - t / 139.) / (speed * 10.) + lineTeam;    // min(50., distance(posInterpolated, position)) / 50.;

      vec3 newPos = position + vec3( cos(speed*time), cos(1. - vDist), sin(1. - vDist) );  // position  * (1. + sin(time * indice) / 1000000.);    // 10. * vec3( cos(speed*time), cos(1. - vDist), sin(1. - vDist) );
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);

    */
/*

    float t = mod (time * 20., 13900);
    int indiceC = int(t / 100);

    int correspondingCoord = int(indice) / 13900
*/

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
  `;

    
  const fragmentShaderLiness = `
  #include <logdepthbuf_pars_fragment>
  uniform float time;
 // varying float vDist;
 // varying float colTeam;

  void main(){
    #include <logdepthbuf_fragment>
    gl_FragColor =  vec4(1.,sin(time),0.,1.);  // vec4(1.,  colTeam, 0., max(1. - vDist, 0.02)); 
  }
  `;
  var time = 0;
  var  uniformsLiness = {
       // posGPS: new THREE.Uniform(arrPosGPS2),       
      //  color: {type: 'c', value: new THREE.Color('white')},      
        time       : {type: 'f', value: time}                      // time to create animation
    };

    let materialLiness = new THREE.ShaderMaterial({
        uniforms: uniformsLiness,
        vertexShader: vertexShaderLiness,
        fragmentShader: fragmentShaderLiness,
        transparent: true,
        opacity: 0.5,
        //blending: THREE.AdditiveBlending,
        //side: THREE.DoubleSide,
        depthTest: false
    });

/*
  linesX = new THREE.LineSegments( geometryL, materialLiness );
  linesX.frustumCulled = false;
  globeView.scene.add( linesX );
  console.log("linesX", linesX);
*/

function altitudeRoads(properties) {
    // console.log('props ', properties);
    //console.log("z_ini : ", properties.z_ini);
    return 150;
}

let getColorForLevelX = (nivEau) => ( (alti) => getColor(alti, nivEau) );
let colorForWater = getColorForLevelX(5);

function colorRoads(properties){
    let altiRoads = properties.z_ini;
    //console.log('alti_roads ', altiRoads);
    return colorForWater(altiRoads);
}

function acceptFeature(p) {
    return p.z_min !== 9999;
}

function addShaderRoads(m){

    console.log("addShaderRoads",m);
   // m.material.depthTest = false;
   // m.frustumCulled = false;
   // m = new THREE.Mesh(new THREE.CylinderGeometry( 7000000, 7000000, 20, 32 ), new THREE.MeshBasicMaterial({color: new THREE.Color(0xff0000)}));
   // m.material = materialLiness;

}



var lineMaterial = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors});
function featureToLine(feature, options) {
    const ptsIn = feature.vertices;
    const normals = feature.normals;
    const vertices = new Float32Array(ptsIn.length);
    const colors = new Uint8Array(ptsIn.length);
    const count = ptsIn.length / 3;

    const batchIds = options.batchId ? new Uint32Array(count) : undefined;
    let featureId = 0;

    coordinatesToVertices(ptsIn, normals, vertices, options.altitude);
    const geom = new THREE.BufferGeometry();
    geom.addAttribute('position', new THREE.BufferAttribute(vertices, 3));

    if (feature.geometry.length > 1) {
        const countIndices = (count - feature.geometry.length) * 2;
        const indices = new Uint16Array(countIndices);
        let i = 0;
        // Multi line case
        for (const geometry of feature.geometry) {
            const color = getProperty('color', options, randomColor, geometry.properties);
            const start = geometry.indices[0].offset;
            // To avoid integer overflow with indice value (16 bits)
            if (start > 0xffff) {
                console.warn('Feature to Line: integer overflow, too many points in lines');
                break;
            }
            const count = geometry.indices[0].count;
            const end = start + count;
            fillColorArray(colors, count, color, start);
            for (let j = start; j < end - 1; j++) {
                if (j < 0xffff) {
                    indices[i++] = j;
                    indices[i++] = j + 1;
                } else {
                    break;
                }
            }
            if (batchIds) {
                const id = options.batchId(geometry.properties, featureId);
                for (let i = start; i < end; i++) {
                    batchIds[i] = id;
                }
                featureId++;
            }
        }
        geom.addAttribute('color', new THREE.BufferAttribute(colors, 3, true));
        if (batchIds) { geom.addAttribute('batchId', new THREE.BufferAttribute(batchIds, 1)); }
        geom.setIndex(new THREE.BufferAttribute(indices, 1));
        //console.log("geommmmmm", geom);
        //globeView.scene.add(new THREE.LineSegments(geom, lineMaterial));
        //var llll = new THREE.LineSegments(geom, lineMaterial);
        //globeView.scene.add(llll);
        return new THREE.LineSegments(geom, lineMaterial);
    } else {
        const color = getProperty('color', options, randomColor, feature.geometry.properties);
        fillColorArray(colors, count, color);
        geom.addAttribute('color', new THREE.BufferAttribute(colors, 3, true));
        if (batchIds) {
            const id = options.batchId(feature.geometry.properties, featureId);
            for (let i = 0; i < count; i++) {
                batchIds[i] = id;
            }
            geom.addAttribute('batchId', new THREE.BufferAttribute(batchIds, 1));
        }
        
        return new THREE.Line(geom, lineMaterial);
    }
}


function featureToMesh(feature, options) {
    if (!feature.vertices) {
        return;
    }
    var mesh =  featureToLine(feature, options);

    mesh.feature = feature;
   // mesh.material.depthTest = false;
    
    //mesh.computeBoundingSphere();
    //mesh.computeBoundingBox();
    //mesh.frustumCulled = false;
    console.log("mmmmmmmmmmmmmmmmmesh", mesh);
    return mesh;
}

function featuresToThree(features, options) {
    if (!features || features.length == 0) { return; }

    if (features.length == 1) {
        return featureToMesh(features[0], options);
    }
}

function convert(options = {}) {
    return function _convert(collection) {
        if (!collection) { return; }

        return featuresToThree(collection.features, options);
    };
}



let roads = {
    id: 'WFS Roads',
    type: 'geometry',
    
    convert: convert({
        color: colorRoads,
        altitude: altitudeRoads}),
    /*function test(){
        var m = new THREE.Mesh(new THREE.SphereGeometry( 7000000, 32, 32 ), new THREE.MeshBasicMaterial({color: new THREE.Color(0xff0000), side: THREE.DoubleSide, depthTest:false}));
        m.position.set(4198602, 165100, 4782417);
        return m;
    },
    */
    /*
    Feature2Mesh.convert({
        color: colorRoads,
        altitude: altitudeRoads,
    }),
*/
/*    itowns.Feature2Mesh.convert({
        color: colorRoads,
        altitude: altitudeRoads,
      //  extrude: extrudeRoads,

    }),
    
*/  
    update: itowns.FeatureProcessing.update,
    onMeshCreated: addShaderRoads,
    filter: acceptFeature,
    source: {
        url: 'https://wxs.ign.fr/oej022d760omtb9y4b19bubh/geoportail/wfs?',
        protocol: 'wfs',
        version: '2.0.0',
        typeName: 'BDTOPO_BDD_WLD_WGS84G:route',
        projection: 'EPSG:4326',
        ipr: 'IGN',
        format: 'application/json',
        zoom: { min: 14, max: 16 },  // Beware that showing building at smaller zoom than ~16 create some holes as the WFS service can't answer more than n polylines per request
    }
};



export  {roads, materialLiness};
