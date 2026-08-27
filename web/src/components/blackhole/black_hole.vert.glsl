#version 300 es
// VivoFlow black hole — WebGL2 fullscreen triangle (GLSL ES 3.00).
precision highp float;

const vec2 V0 = vec2(-1.0, -1.0);
const vec2 V1 = vec2(3.0, -1.0);
const vec2 V2 = vec2(-1.0, 3.0);

out vec2 v_uv;

void main() {
  vec2 xy = gl_VertexID == 0 ? V0 : (gl_VertexID == 1 ? V1 : V2);
  gl_Position = vec4(xy, 0.0, 1.0);
  v_uv = vec2(xy.x * 0.5 + 0.5, 1.0 - (xy.y * 0.5 + 0.5));
}
