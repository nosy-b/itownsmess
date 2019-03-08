
import * as itowns from 'itowns';
import * as THREE from 'three';
//import Earcut from 'earcut';
//import Coordinates from '../../Core/Geographic/Coordinates';

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


const pointMaterial = new THREE.PointsMaterial();
function featureToPoint(feature, options) {
    const ptsIn = feature.vertices;
    const normals = feature.normals;
    const vertices = new Float32Array(ptsIn.length);
    const colors = new Uint8Array(ptsIn.length);

    const batchIds = options.batchId ? new Uint32Array(ptsIn.length / 3) : undefined;
    let featureId = 0;

    coordinatesToVertices(ptsIn, normals, vertices, options.altitude);

    for (const geometry of feature.geometry) {
        const color = getProperty('color', options, randomColor, geometry.properties);
        const start = geometry.indices[0].offset;
        const count = geometry.indices[0].count;
        fillColorArray(colors, count, color, start);

        if (batchIds) {
            const id = options.batchId(geometry.properties, featureId);
            for (let i = start; i < start + count; i++) {
                batchIds[i] = id;
            }
            featureId++;
        }
    }

    const geom = new THREE.BufferGeometry();
    geom.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.addAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    if (batchIds) { geom.addAttribute('batchId', new THREE.BufferAttribute(batchIds, 1)); }

    return new THREE.Points(geom, pointMaterial);
}

var lineMaterial = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors });
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

const color = new THREE.Color();
const material = new THREE.MeshBasicMaterial();





/**
 * Convert a [Feature]{@link Feature#geometry}'s geometry to a Mesh
 *
 * @param {Object} feature - a Feature's geometry
 * @param {Object} options - options controlling the conversion
 * @param {number|function} options.altitude - define the base altitude of the mesh
 * @param {number|function} options.extrude - if defined, polygons will be extruded by the specified amount
 * @param {object|function} options.color - define per feature color
 * @return {THREE.Mesh} mesh
 */
function featureToMesh(feature, options) {
    if (!feature.vertices) {
        return;
    }

    var mesh;
    switch (feature.type) {
        case 'point':
        case 'multipoint': {
            mesh = featureToPoint(feature, options);
            break;
        }
        case 'linestring':
        case 'multilinestring': {
            mesh = featureToLine(feature, options);
            break;
        }
        case 'polygon':
       /* case 'multipolygon': {
            if (options.extrude) {
                mesh = featureToExtrudedPolygon(feature, options);
            } else {
                mesh = featureToPolygon(feature, options);
            }
            break;
        }*/
        default:
    }

    // set mesh material
    // mesh.material.vertexColors = THREE.VertexColors;
    // mesh.material.color = new THREE.Color(0xffffff);

    mesh.feature = feature;
    return mesh;
}

function featuresToThree(features, options) {
    if (!features || features.length == 0) { return; }

    if (features.length == 1) {
        return featureToMesh(features[0], options);
    }

    const group = new THREE.Group();
    group.minAltitude = Infinity;

    for (const feature of features) {
        const mesh = featureToMesh(feature, options);
        group.add(mesh);
        group.minAltitude = Math.min(mesh.minAltitude, group.minAltitude);
    }

    return group;
}

/**
 * @module Feature2Mesh
 */
export default {
    /**
     * Return a function that converts [Features]{@link module:GeoJsonParser} to Meshes. Feature collection will be converted to a
     * a THREE.Group.
     *
     * @param {Object} options - options controlling the conversion
     * @param {number|function} options.altitude - define the base altitude of the mesh
     * @param {number|function} options.extrude - if defined, polygons will be extruded by the specified amount
     * @param {object|function} options.color - define per feature color
     * @param {Object} options.attributes - optional dictionnary of custom attributes. The key is the attribute name and the value is a function that takes the feature geometry and the feature index
     * @param {function} options.batchId - optional function to create batchId attribute. It is passed the feature property and the feature index
     * @return {function}
     */
    convert(options = {}) {
        return function _convert(collection) {
            if (!collection) { return; }

            return featuresToThree(collection.features, options);
        };
    },
};
