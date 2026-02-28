# Anniversary Puzzle Site

Simple static puzzle site designed for GitHub Pages.

## What is included
- `index.html`: page layout and puzzle sections
- `style.css`: visual style, responsive layout, and vine rendering styles
- `script.js`: clue rendering, procedural binary-tree vine glyphs, final translation check, and verifier logic
- `tools/generate_clue_images_openai.py`: OpenAI image-generation pipeline for clue scene PNGs
- `assets/IMAGE_PROMPTS.md`: the exact prompts used for clue image generation
- `assets/clues/.gitkeep`: placeholder for generated clue images

## How to use
1. Generate clue images with OpenAI:
   - `OPENAI_API_KEY=... python3 tools/generate_clue_images_openai.py --force`
2. Confirm files exist:
   - `assets/clues/clue-01.png` ... `assets/clues/clue-05.png`
3. Open `index.html` locally and test the puzzle.
4. Push this folder to a GitHub repository and enable GitHub Pages.

## Puzzle model
- One sentence is one left-to-right vine.
- Every word is a sprout branch off the main vine.
- Clue scenes are image-gen outputs (`.png`, optional `.webp/.jpg` fallback).
- Only glyphs are SVG.
- Final target sentence: `Chris hides gift under TV`.
