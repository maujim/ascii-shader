uniform sampler2D uCharacters;
uniform float uCharactersCount;
uniform float uCellSize;
uniform bool uInvert;
uniform vec3 uColor;

const vec2 SIZE = vec2(16.);

vec3 greyscale(vec3 color, float strength) {
    float g = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(color, vec3(g), strength);
}

vec3 greyscale(vec3 color) {
    return greyscale(color, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 cell = resolution / uCellSize;
    vec2 grid = 1.0 / cell;
    vec2 pixelizedUV = grid * (0.5 + floor(uv / grid));
    vec4 pixelized = texture2D(inputBuffer, pixelizedUV);
    float greyscaled = greyscale(pixelized.rgb).r;

    if (uInvert) {
        greyscaled = 1.0 - greyscaled;
    }

    // Scale greyscale value to the range of the available character set
    float characterIndex = floor((uCharactersCount - 1.0) * greyscaled);

    // If there are fewer characters, we want to avoid the space character being overly dominant.
    // This adjustment ensures that fewer characters (e.g., 6) still fill the entire space.
    float scaleFactor = max(1.0, float(uCharactersCount) / 20.0);
    characterIndex = floor(characterIndex * scaleFactor);

    // Map the character index to the correct character in the set
    vec2 characterPosition = vec2(mod(characterIndex, SIZE.x), floor(characterIndex / SIZE.y));
    vec2 offset = vec2(characterPosition.x, -characterPosition.y) / SIZE;
    vec2 charUV = mod(uv * (cell / SIZE), 1.0 / SIZE) - vec2(0., 1.0 / SIZE) + offset;
    vec4 asciiCharacter = texture2D(uCharacters, charUV);

    asciiCharacter.rgb = pixelized.rgb * asciiCharacter.r;
    asciiCharacter.a = pixelized.a;

    float boundarySize = 0.1;
    float transitionStart = 0.5 - (boundarySize / 16.0);
    float transitionEnd = 0.5 + (boundarySize / 8.0);

    // smooth transition between regular and ascii
    float blendFactor = smoothstep(transitionStart, transitionEnd, uv.x); // Adjust 0.45 - 0.55 for a smoother or sharper transition
    vec4 originalColor = texture2D(inputBuffer, uv);
    outputColor = mix(originalColor, asciiCharacter, blendFactor);
}
