
window.GlobeGL = (canvas) => {
const opt = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
const gl = canvas.getContext('webgl', opt) || canvas.getContext('experimental-webgl', opt);
if (!gl) return null;
const deriv = !!gl.getExtension('OES_standard_derivatives');
const VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
const FS = (deriv ? '#extension GL_OES_standard_derivatives : enable\n' : '') + `
precision highp float;
uniform vec2 uO; uniform float uR, uH, uGlow;
uniform vec3 uE, uN, uC, uS, uAtm, uLit;
uniform float uKeep, uDetA;
uniform vec4 uBox;
uniform sampler2D uDay, uNight, uDet, uDetN;
const float PI = 3.14159265, TAU = 6.2831853;
void main(){
  vec2 q = vec2(gl_FragCoord.x - uO.x, gl_FragCoord.y - (uH - uO.y)) / uR;
  float r = length(q), px = (r - 1.0) * uR;                 // device pixels outside the limb (< 0 inside)
  float cov = clamp(0.5 - px, 0.0, 1.0);
  float glow = uGlow > 0.0 ? pow(clamp(1.0 - max(px, 0.0) / uGlow, 0.0, 1.0), 2.2) * 0.55 : 0.0;
  if (cov <= 0.0) { gl_FragColor = vec4(uAtm * glow, glow); return; }
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec3 p = q.x * uE + q.y * uN + z * uC;
  float lon = atan(p.y, p.x), lat = asin(clamp(p.z, -1.0, 1.0));
  vec2 uv = vec2(lon / TAU + 0.5, 0.5 - lat / PI);
${deriv ? '  float u2 = fract(uv.x + 0.5) - 0.5; if (fwidth(u2) < fwidth(uv.x) - 1e-6) uv.x = u2;' : ''}
  vec3 day = texture2D(uDay, uv).rgb;
  float lights = texture2D(uNight, uv).r;
  if (uDetA > 0.0) {
    vec2 t = (vec2(lon, lat) - uBox.xy) / (uBox.zw - uBox.xy);
    float e = min(min(t.x, 1.0 - t.x), min(t.y, 1.0 - t.y));
    if (e > 0.0) {
      vec2 tt = vec2(t.x, 1.0 - t.y); float k = smoothstep(0.0, 0.06, e) * uDetA;
      day = mix(day, texture2D(uDet, tt).rgb, k); lights = mix(lights, texture2D(uDetN, tt).r, k);
    }
  }
  float s = dot(p, uS);                                     // the sun's height over the horizon, as a sine
  float dayF = smoothstep(-0.105, 0.03, s);                 // full day down to civil twilight's end (sun 6 degrees under)
  vec3 dcol = day * mix(0.74, 1.04, smoothstep(-0.02, 0.55, s));
  vec3 ncol = day * uKeep + uLit * pow(lights, 1.8) * 2.6;
  vec3 col = mix(ncol, dcol, dayF);
  float rim = pow(1.0 - z, 2.6);                            // haze thickens towards the limb, on the day side most
  col = mix(col, uAtm, rim * (0.18 + 0.42 * dayF));
  gl_FragColor = vec4(col * cov + uAtm * glow * (1.0 - cov), cov + glow * (1.0 - cov));
}`;
const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
let prog;
try {
prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
} catch (e) { return null; }
gl.useProgram(prog);
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const aLoc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
const U = {}; ['uO', 'uR', 'uH', 'uGlow', 'uE', 'uN', 'uC', 'uS', 'uAtm', 'uLit', 'uKeep', 'uDetA', 'uBox', 'uDay', 'uNight', 'uDet', 'uDetN'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
gl.uniform1i(U.uDay, 0); gl.uniform1i(U.uNight, 1); gl.uniform1i(U.uDet, 2); gl.uniform1i(U.uDetN, 3);

const texture = (img, unit, wrap) => {
const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
const pot = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
const mip = pot && (deriv || !wrap);
if (mip) gl.generateMipmap(gl.TEXTURE_2D);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap && pot ? gl.REPEAT : gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
return t;
};
let day = null, night = null;
const dets = new Map();
const D2R = Math.PI / 180;
return {
setWorld(dayImg, nightImg) { day = texture(dayImg, 0, true); night = texture(nightImg, 1, true); },
hasRegion: key => dets.has(key),
addRegion(key, dayImg, nightImg) { dets.set(key, [texture(dayImg, 2, false), texture(nightImg, 3, false)]); },
draw(o) {
if (!day) return;
gl.viewport(0, 0, o.W, o.H);
gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
gl.uniform2f(U.uO, o.ox * o.dpr, o.oy * o.dpr); gl.uniform1f(U.uR, o.R * o.dpr); gl.uniform1f(U.uH, o.H);
gl.uniform1f(U.uGlow, o.R < 4000 ? Math.max(5, Math.min(26, o.R * 0.05)) * o.dpr : 0);
gl.uniform3fv(U.uE, o.E); gl.uniform3fv(U.uN, o.N); gl.uniform3fv(U.uC, o.C); gl.uniform3fv(U.uS, o.S);
gl.uniform3fv(U.uAtm, o.atm); gl.uniform3fv(U.uLit, o.lit); gl.uniform1f(U.uKeep, o.keep);
gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, day);
gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, night);
const rg = o.region && dets.get(o.region.key);
gl.uniform1f(U.uDetA, rg ? o.region.a : 0);
if (rg) {
const b = o.region.box;
gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, rg[0]);
gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, rg[1]);
gl.uniform4f(U.uBox, b[0] * D2R, b[1] * D2R, b[2] * D2R, b[3] * D2R);
} else {
gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, day);
gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, night);
}
gl.drawArrays(gl.TRIANGLES, 0, 3);
}
};
};
