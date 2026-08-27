#version 300 es
// VivoFlow black hole — geodesic fragment shader (WebGL2).
// Port of black_hole.wgsl (MIT, Copyright (c) 2026 GreenScreen410), itself
// from BlackHoleTrash / s0xDk/ghostty-blackhole after Eric Bruneton.
// Desktop texture, cursor overlay and absorption jet are omitted.
precision highp float;
precision highp int;

layout(std140) uniform Uniforms {
  vec2 resolution;
  float time;
  float has_desktop;
  float temp;
  float incl;
  float roll;
  float inner_r;
  float outer_r;
  float opac;
  float dopp;
  float beam;
  float gain;
  float contr;
  float wind;
  float speed;
  float expo;
  float star;
  float hole_radius;
  float center_x;
  float center_y;
  float spin;
  float spin_phase;
  float _pad;
  vec4 cursor;
} u;

in vec2 v_uv;
out vec4 fragColor;

const float LENS_DEPTH = 13.0;
const int N_STEPS = 48;
const float B_CRIT = 2.5980762;
const int KERR_STEPS = 88;

float gmod(float x, float y) { return x - y * floor(x / y); }

vec2 mirrorUV(vec2 uvin) {
  vec2 m = uvin - 2.0 * floor(uvin / 2.0);
  return 1.0 - abs(1.0 - m);
}

vec2 rot(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

float hash21(vec2 pin) {
  vec2 p = fract(pin * vec2(234.34, 435.345));
  p = p + dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoiseWrapY(vec2 p, float perY) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = gmod(i.y, perY);
  float y1 = gmod(i.y + 1.0, perY);
  return mix(
    mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), f.x),
    mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), f.x),
    f.y
  );
}

vec3 blackbody(float T) {
  float t = clamp(T, 1500.0, 40000.0) / 100.0;
  float r = 1.0;
  if (t > 66.0) r = clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
  float g = 0.0;
  if (t <= 66.0) g = clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0);
  else g = clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  float b = 1.0;
  if (t < 66.0) {
    if (t <= 19.0) b = 0.0;
    else b = clamp(0.5432068 * log(t - 10.0) - 1.1962540, 0.0, 1.0);
  }
  return vec3(r, g, b);
}

vec3 stars(vec3 d) {
  vec2 sph = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0)));
  vec2 g = sph * 40.0;
  vec2 id = floor(g);
  float h = hash21(id);
  if (h < 0.92) return vec3(0.0);
  vec2 f = fract(g) - 0.5;
  vec2 off = (vec2(hash21(id + 17.3), hash21(id + 31.7)) - 0.5) * 0.7;
  float spark = smoothstep(0.10, 0.0, length(f - off));
  float tw = 0.7 + 0.3 * sin(u.time * (0.5 + 2.0 * hash21(id + 5.1)) + 40.0 * h);
  vec3 tint = mix(vec3(1.0, 0.82, 0.60), vec3(0.75, 0.85, 1.0), hash21(id + 2.9));
  return tint * spark * tw * ((h - 0.92) / 0.08);
}

vec3 background(vec2 uvin) {
  vec2 uvm = mirrorUV(uvin);
  float d = length(uvm - vec2(0.5));
  return vec3(0.010, 0.012, 0.028) * (1.0 - 0.45 * clamp(d, 0.0, 1.0));
}

vec4 shade_crossing(vec3 xc, vec3 vdir, vec3 n, vec3 e2, float rin, float rout, float t, float sdir, float spd, float trans) {
  float rc = length(xc);
  if (rc <= rin || rc >= rout) return vec4(0.0);
  float band = smoothstep(rin, rin * 1.25, rc) * (1.0 - smoothstep(rout * 0.70, rout, rc));
  float phi = atan(dot(xc, e2), xc.x);
  float turns = phi / 6.2831853;
  float kep = pow(rin / rc, 1.5);
  float gloc = sqrt(max(1.0 - 1.5 / rc, 0.02));
  float swirl = rc * u.wind * 0.12 - t * kep * spd * gloc * sdir - u.spin_phase * kep;
  float streaks = vnoiseWrapY(vec2(rc * 2.8, turns * 19.0 + swirl * 3.0), 19.0) * 0.65
                + vnoiseWrapY(vec2(rc * 1.0, turns * 9.0 + swirl * 1.5 + 7.0), 9.0) * 0.35;
  streaks = 0.35 + u.contr * streaks * streaks;
  vec3 gasdir = normalize(cross(n, xc)) * sdir;
  float beta = clamp(inversesqrt(max(2.0 * (rc - 1.0), 0.2)), 0.0, 0.99);
  float g = gloc / max(1.0 + beta * dot(gasdir, vdir), 0.05);
  g = mix(1.0, g, u.dopp);
  float xpr = max(1.0 - sqrt(rin / rc), 0.0);
  float tprof = pow(rin / rc, 0.75) * pow(xpr, 0.25) / 0.488;
  vec3 cbb = blackbody(u.temp * tprof * g) * max(u.cursor.xyz, vec3(1e-4));
  float boost = pow(g, u.beam);
  float density = band * streaks;
  return vec4(trans * cbb * (u.gain * 2.2 * density * tprof * tprof * boost), density);
}

float drag_twist(float b_rs, float spin_signed, float spin_phase) {
  float active_phase = abs(spin_signed) >= 0.005 ? spin_phase : 0.0;
  return (1.3 * spin_signed + active_phase) / (1.0 + 0.8 * pow(b_rs / B_CRIT, 2.0));
}

float kerr_isco_rs(float spin) {
  float a = clamp(spin, 0.0, 0.999);
  float z1 = 1.0 + pow(1.0 - a * a, 1.0 / 3.0) * (pow(1.0 + a, 1.0 / 3.0) + pow(1.0 - a, 1.0 / 3.0));
  float z2 = sqrt(3.0 * a * a + z1 * z1);
  float r_m = 3.0 + z2 - sqrt((3.0 - z1) * (3.0 + z1 + 2.0 * z2));
  return r_m * 0.5;
}

float ks_r(vec3 pos, float a) {
  float rho2 = dot(pos, pos);
  float bq = rho2 - a * a;
  float r2 = 0.5 * (bq + sqrt(bq * bq + 4.0 * a * a * pos.z * pos.z));
  return sqrt(max(r2, 1e-8));
}

float kerr_h(vec3 pos, vec3 pm, float a) {
  float r = ks_r(pos, a);
  float r2 = r * r;
  float den = r2 + a * a;
  vec3 l = vec3(
    (r * pos.x + a * pos.y) / den,
    (r * pos.y - a * pos.x) / den,
    pos.z / max(r, 1e-6)
  );
  float f = r2 * r / (r2 * r2 + a * a * pos.z * pos.z);
  float lp = dot(l, pm) + 1.0;
  return 0.5 * (dot(pm, pm) - 1.0) - 0.5 * f * lp * lp;
}

vec3 kerr_dxdl(vec3 pos, vec3 pm, float a) {
  float r = ks_r(pos, a);
  float r2 = r * r;
  float den = r2 + a * a;
  vec3 l = vec3(
    (r * pos.x + a * pos.y) / den,
    (r * pos.y - a * pos.x) / den,
    pos.z / max(r, 1e-6)
  );
  float f = r2 * r / (r2 * r2 + a * a * pos.z * pos.z);
  float lp = dot(l, pm) + 1.0;
  return pm - f * lp * l;
}

vec3 kerr_dpdl(vec3 pos, vec3 pm, float a) {
  float e = 2e-3;
  return vec3(
    kerr_h(pos - vec3(e, 0.0, 0.0), pm, a) - kerr_h(pos + vec3(e, 0.0, 0.0), pm, a),
    kerr_h(pos - vec3(0.0, e, 0.0), pm, a) - kerr_h(pos + vec3(0.0, e, 0.0), pm, a),
    kerr_h(pos - vec3(0.0, 0.0, e), pm, a) - kerr_h(pos + vec3(0.0, 0.0, e), pm, a)
  ) / (2.0 * e);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u.resolution.x / max(u.resolution.y, 1.0);
  float t = u.time;
  float rin = max(u.inner_r, 1.6);
  float rout = max(u.outer_r, rin + 0.5);
  float rh = u.hole_radius;
  vec2 center = vec2(u.center_x, u.center_y);
  vec2 p = (uv - center) * vec2(aspect, 1.0);
  float plen = length(p);
  float W = B_CRIT / max(rh, 1e-4);
  vec2 pr = rot(vec2(p.x, -p.y), u.roll) * W;
  float b = length(pr);
  float window = exp(-pow(plen / (7.0 * rh), 2.0));
  float bmax = rout + 3.0;
  float Z0 = max(14.0, rout + 5.0);

  if (b >= bmax) {
    float uu = Z0 * inversesqrt(Z0 * Z0 + b * b);
    float defl = (2.0 / (W * W)) / max(plen, 1e-4)
               * (1.29 * uu + 0.07) * max(LENS_DEPTH - 2.14 * uu + 0.75, 0.0)
               * window;
    vec2 dir = p / max(plen, 1e-5);
    float ab = 0.035 * smoothstep(1.0, 2.0, b / bmax);
    float sdir_far = u.speed < 0.0 ? -1.0 : 1.0;
    float tw = drag_twist(b, u.spin * sdir_far, u.spin_phase);
    vec2 sp_r = rot(p - dir * defl * (1.0 - ab), tw);
    vec2 sp_g = rot(p - dir * defl, tw);
    vec2 sp_b = rot(p - dir * defl * (1.0 + ab), tw);
    vec3 col = vec3(
      background(center + sp_r / vec2(aspect, 1.0)).r,
      background(center + sp_g / vec2(aspect, 1.0)).g,
      background(center + sp_b / vec2(aspect, 1.0)).b
    );
    vec3 d = normalize(vec3(-(pr / b) * (2.0 / b), -1.0));
    fragColor = vec4(col + stars(d) * u.star * window, 1.0);
    return;
  }

  vec3 x = vec3(pr, Z0);
  vec3 v = vec3(0.0, 0.0, -1.0);
  float h2 = dot(pr, pr);
  float ci = cos(u.incl);
  float si = sin(u.incl);
  vec3 n = vec3(0.0, si, ci);
  vec3 e2 = vec3(0.0, ci, -si);
  float sdir = u.speed < 0.0 ? -1.0 : 1.0;
  float spd = abs(u.speed);
  vec3 emitc = vec3(0.0);
  float trans = 1.0;
  bool captured = false;

  if (u.spin < 0.005) {
    float sPrev = dot(x, n);
    vec3 xPrev = x;
    for (int i = 0; i < N_STEPS; i++) {
      float r2 = dot(x, x);
      if (r2 < 1.0) { captured = true; break; }
      if (x.z < -Z0 && v.z < 0.0) break;
      if (r2 > 4.0 * Z0 * Z0) break;
      float r = sqrt(r2);
      float dt = clamp(0.16 * r, 0.03, 1.5);
      vec3 acc = -1.5 * h2 * x / (r2 * r2 * r);
      v += acc * (0.5 * dt);
      x += v * dt;
      r2 = dot(x, x);
      r = sqrt(r2);
      acc = -1.5 * h2 * x / (r2 * r2 * r);
      v += acc * (0.5 * dt);
      float s = dot(x, n);
      if (s * sPrev < 0.0 && trans > 0.02) {
        float tc = sPrev / (sPrev - s);
        vec3 xc = mix(xPrev, x, tc);
        vec4 sh = shade_crossing(xc, normalize(v), n, e2, rin, rout, t, sdir, spd, trans);
        emitc += sh.rgb;
        trans *= (1.0 - clamp(u.opac * sh.a, 0.0, 1.0));
      }
      sPrev = s;
      xPrev = x;
    }
    if (!captured && dot(x, x) < 4.0) captured = true;
  } else {
    float a = 0.5 * u.spin * sdir;
    float rhor = 0.5 + sqrt(max(0.25 - a * a, 0.0));
    float rin_k = max(rin * kerr_isco_rs(u.spin) / 3.0, kerr_isco_rs(u.spin));
    vec3 xb = vec3(x.x, dot(x, e2), dot(x, n));
    vec3 pb = vec3(v.x, dot(v, e2), dot(v, n));
    float sPrev = xb.z;
    vec3 xPrev = xb;
    for (int i = 0; i < KERR_STEPS; i++) {
      float r = ks_r(xb, a);
      if (r < rhor + 0.02) { captured = true; break; }
      if (r > 1.4 * Z0 && dot(xb, kerr_dxdl(xb, pb, a)) > 0.0) break;
      float dl = clamp(0.16 * r, 0.02, 1.1);
      pb += kerr_dpdl(xb, pb, a) * (0.5 * dl);
      xb += kerr_dxdl(xb, pb, a) * dl;
      pb += kerr_dpdl(xb, pb, a) * (0.5 * dl);
      if (xb.z * sPrev < 0.0 && trans > 0.02) {
        float tc = sPrev / (sPrev - xb.z);
        vec3 xcb = mix(xPrev, xb, tc);
        vec3 xc = xcb.x * vec3(1.0, 0.0, 0.0) + xcb.y * e2 + xcb.z * n;
        vec3 vb = kerr_dxdl(xb, pb, a);
        vec3 vw = vb.x * vec3(1.0, 0.0, 0.0) + vb.y * e2 + vb.z * n;
        vec4 sh = shade_crossing(xc, normalize(vw), n, e2, rin_k, rout, t, sdir, spd, trans);
        emitc += sh.rgb;
        trans *= (1.0 - clamp(u.opac * sh.a, 0.0, 1.0));
      }
      sPrev = xb.z;
      xPrev = xb;
    }
    if (!captured && ks_r(xb, a) < 2.4) captured = true;
    vec3 vb = kerr_dxdl(xb, pb, a);
    x = xb.x * vec3(1.0, 0.0, 0.0) + xb.y * e2 + xb.z * n;
    v = vb.x * vec3(1.0, 0.0, 0.0) + vb.y * e2 + vb.z * n;
  }

  vec3 bg = vec3(0.0);
  if (!captured) {
    vec3 d = normalize(v);
    bg += stars(d) * u.star * window;
    if (d.z < -0.05) {
      float tpl = (-LENS_DEPTH - x.z) / d.z;
      vec3 hp = x + d * tpl;
      vec2 q = rot(hp.xy, -u.roll) / W;
      vec2 sp = vec2(q.x, -q.y);
      sp = rot(sp, drag_twist(b, u.spin * sdir, u.spin_phase));
      vec2 suv = center + (p + (sp - p) * window) / vec2(aspect, 1.0);
      float toward = smoothstep(0.05, 0.35, -d.z);
      bg += background(suv) * toward;
    }
  }

  vec3 col = bg * trans + (vec3(1.0) - exp(-emitc * u.expo));
  fragColor = vec4(col, 1.0);
}
