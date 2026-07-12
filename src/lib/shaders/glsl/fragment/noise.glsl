uniform sampler2D inputTexture;
uniform float time;
uniform float premultiply;
uniform vec2 resolution;
varying vec2 vUv;

float rand(vec2 n) {
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

void main() {
	vec4 inputColor = texture2D(inputTexture, vUv);
	vec2 uv = vUv * (resolution / max(min(resolution.x, resolution.y), 1.0));
	vec3 noise = vec3(rand(uv * (1.0 + time)));
	vec3 overlay = mix(noise, inputColor.rgb * noise, step(0.5, premultiply));

	gl_FragColor = vec4(min(inputColor.rgb + overlay, vec3(1.0)), inputColor.a);
}
