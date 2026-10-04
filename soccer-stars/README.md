# Soccer Stars

A vertical climbing platformer for the browser, built with three.js.

Pick one of four procedurally-built animal stars — Lion, Hyena, Giraffe or
Elephant — and jump platform to platform as high as you can. Score is your
height in meters. Fall below the camera and it's full time; reach the golden
trophy at 200 m to lift the cup.

## Controls

| Key | Action |
| --- | --- |
| A / Left arrow | Move left |
| D / Right arrow | Move right |
| W / Up arrow / Space | Jump |
| P | Pause |
| M | Music on/off |
| 1-4 | Pick a player on the select screen |

Touch devices get on-screen left / right / jump buttons during play.

## How it's built

- Plain JavaScript + [three.js](https://threejs.org) (r160, vendored locally in
  `js/vendor/` — the game runs fully offline).
- No image, model, font or audio files: every character is assembled at
  runtime from box, sphere and cylinder primitives, the ball texture and name
  labels are painted onto canvases, and all sound is synthesized with WebAudio.
- Scene flow mirrors a classic arcade loop: boot → menu → character select →
  play → full time / champions screens, driven by a tiny scene manager in
  `js/main.js`.
- Best height is saved in `localStorage`.
