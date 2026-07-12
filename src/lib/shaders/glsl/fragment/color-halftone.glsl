#define SQRT2_MINUS_ONE 0.41421356
#define SQRT2_HALF_MINUS_ONE 0.20710678
#define PI 3.14159265
#define PI2 6.28318531
#define SHAPE_DOT 1
#define SHAPE_ELLIPSE 2
#define SHAPE_LINE 3
#define SHAPE_SQUARE 4
#define SHAPE_DIAMOND 5

uniform sampler2D inputTexture;
uniform float radius;
uniform float rotateR;
uniform float rotateG;
uniform float rotateB;
uniform float scatter;
uniform float width;
uniform float height;
uniform int shape;

varying vec2 vUv;

const int samples = 8;

float hypot2(float x, float y) {
    return sqrt(x * x + y * y);
}

float rand(vec2 seed) {
    return fract(sin(dot(seed.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float distanceToDotRadius(float channel, vec2 coord, vec2 normal, vec2 p, float angle, float radMax) {
    float dist = hypot2(coord.x - p.x, coord.y - p.y);
    float rad = channel;

    if (shape == SHAPE_DOT) {
        rad = pow(abs(rad), 1.125) * radMax;
    } else if (shape == SHAPE_ELLIPSE) {
        rad = pow(abs(rad), 1.125) * radMax;

        if (dist != 0.0) {
            float dotP = abs((p.x - coord.x) / dist * normal.x + (p.y - coord.y) / dist * normal.y);
            dist = (dist * (1.0 - SQRT2_HALF_MINUS_ONE)) + dotP * dist * SQRT2_MINUS_ONE;
        }
    } else if (shape == SHAPE_LINE) {
        rad = pow(abs(rad), 1.5) * radMax;
        float dotP = (p.x - coord.x) * normal.x + (p.y - coord.y) * normal.y;
        dist = hypot2(normal.x * dotP, normal.y * dotP);
    } else if (shape == SHAPE_SQUARE) {
        float theta = atan(p.y - coord.y, p.x - coord.x) - angle;
        float sinT = abs(sin(theta));
        float cosT = abs(cos(theta));
        rad = pow(abs(rad), 1.4);
        rad = radMax * (rad + ((sinT > cosT) ? rad - sinT * rad : rad - cosT * rad));
    } else if (shape == SHAPE_DIAMOND) {
        float angle45 = PI / 4.0;
        float theta = atan(p.y - coord.y, p.x - coord.x) - angle - angle45;
        float sinT = abs(sin(theta));
        float cosT = abs(cos(theta));
        rad = pow(abs(rad), 1.4);
        rad = radMax * (rad + ((sinT > cosT) ? rad - sinT * rad : rad - cosT * rad));
    }

    return rad - dist;
}

struct Cell {
    vec2 normal;
    vec2 p1;
    vec2 p2;
    vec2 p3;
    vec2 p4;
    float samp1;
    float samp2;
    float samp3;
    float samp4;
};

vec4 getSample(vec2 point) {
    vec4 tex = texture2D(inputTexture, vec2(point.x / width, point.y / height));
    float base = rand(vec2(floor(point.x), floor(point.y))) * PI2;
    float step = PI2 / float(samples);
    float dist = radius * 0.66;

    for (int i = 0; i < samples; ++i) {
        float r = base + step * float(i);
        vec2 coord = point + vec2(cos(r) * dist, sin(r) * dist);
        tex += texture2D(inputTexture, vec2(coord.x / width, coord.y / height));
    }

    tex /= float(samples) + 1.0;
    return tex;
}

float getDotColour(Cell c, vec2 p, int channel, float angle, float aa) {
    if (channel == 0) {
        c.samp1 = getSample(c.p1).r;
        c.samp2 = getSample(c.p2).r;
        c.samp3 = getSample(c.p3).r;
        c.samp4 = getSample(c.p4).r;
    } else if (channel == 1) {
        c.samp1 = getSample(c.p1).g;
        c.samp2 = getSample(c.p2).g;
        c.samp3 = getSample(c.p3).g;
        c.samp4 = getSample(c.p4).g;
    } else {
        c.samp1 = getSample(c.p1).b;
        c.samp2 = getSample(c.p2).b;
        c.samp3 = getSample(c.p3).b;
        c.samp4 = getSample(c.p4).b;
    }

    float distC1 = distanceToDotRadius(c.samp1, c.p1, c.normal, p, angle, radius);
    float distC2 = distanceToDotRadius(c.samp2, c.p2, c.normal, p, angle, radius);
    float distC3 = distanceToDotRadius(c.samp3, c.p3, c.normal, p, angle, radius);
    float distC4 = distanceToDotRadius(c.samp4, c.p4, c.normal, p, angle, radius);
    float res = (distC1 > 0.0) ? clamp(distC1 / aa, 0.0, 1.0) : 0.0;
    res += (distC2 > 0.0) ? clamp(distC2 / aa, 0.0, 1.0) : 0.0;
    res += (distC3 > 0.0) ? clamp(distC3 / aa, 0.0, 1.0) : 0.0;
    res += (distC4 > 0.0) ? clamp(distC4 / aa, 0.0, 1.0) : 0.0;
    return clamp(res, 0.0, 1.0);
}

Cell getReferenceCell(vec2 p, vec2 origin, float gridAngle, float step) {
    Cell c;
    vec2 n = vec2(cos(gridAngle), sin(gridAngle));
    float threshold = step * 0.5;
    float dotNormal = n.x * (p.x - origin.x) + n.y * (p.y - origin.y);
    float dotLine = -n.y * (p.x - origin.x) + n.x * (p.y - origin.y);
    vec2 offset = vec2(n.x * dotNormal, n.y * dotNormal);
    float offsetNormal = mod(hypot2(offset.x, offset.y), step);
    float normalDir = (dotNormal < 0.0) ? 1.0 : -1.0;
    float normalScale = ((offsetNormal < threshold) ? -offsetNormal : step - offsetNormal) * normalDir;
    float offsetLine = mod(hypot2((p.x - offset.x) - origin.x, (p.y - offset.y) - origin.y), step);
    float lineDir = (dotLine < 0.0) ? 1.0 : -1.0;
    float lineScale = ((offsetLine < threshold) ? -offsetLine : step - offsetLine) * lineDir;

    c.normal = n;
    c.p1.x = p.x - n.x * normalScale + n.y * lineScale;
    c.p1.y = p.y - n.y * normalScale - n.x * lineScale;

    if (scatter != 0.0) {
        float offMag = scatter * threshold * 0.5;
        float offAngle = rand(vec2(floor(c.p1.x), floor(c.p1.y))) * PI2;
        c.p1.x += cos(offAngle) * offMag;
        c.p1.y += sin(offAngle) * offMag;
    }

    float normalStep = normalDir * ((offsetNormal < threshold) ? step : -step);
    float lineStep = lineDir * ((offsetLine < threshold) ? step : -step);
    c.p2.x = c.p1.x - n.x * normalStep;
    c.p2.y = c.p1.y - n.y * normalStep;
    c.p3.x = c.p1.x + n.y * lineStep;
    c.p3.y = c.p1.y - n.x * lineStep;
    c.p4.x = c.p1.x - n.x * normalStep + n.y * lineStep;
    c.p4.y = c.p1.y - n.y * normalStep - n.x * lineStep;
    return c;
}

void main() {
    vec2 p = vec2(vUv.x * width, vUv.y * height);
    vec2 origin = vec2(0.0, 0.0);
    float aa = (radius < 2.5) ? radius * 0.5 : 1.25;

    Cell cellR = getReferenceCell(p, origin, rotateR, radius);
    Cell cellG = getReferenceCell(p, origin, rotateG, radius);
    Cell cellB = getReferenceCell(p, origin, rotateB, radius);
    float r = getDotColour(cellR, p, 0, rotateR, aa);
    float g = getDotColour(cellG, p, 1, rotateG, aa);
    float b = getDotColour(cellB, p, 2, rotateB, aa);

    gl_FragColor = vec4(r, g, b, texture2D(inputTexture, vUv).a);
}
