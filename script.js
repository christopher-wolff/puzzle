const clues = [
  { id: "01", filename: "clue-01", words: ["chris", "loves", "kimberly"] },
  { id: "02", filename: "clue-02", words: ["chris", "creates", "gift"] },
  { id: "03", filename: "clue-03", words: ["chris", "hides"] },
  { id: "04", filename: "clue-04", words: ["chris", "kimberly", "watch", "tv"] },
  { id: "05", filename: "clue-05", words: ["chris", "hides", "under", "table"] },
];

const finalWords = ["chris", "hides", "gift", "under", "tv"];

const verifierLexicon = [
  { glyph: "kimberly", answers: ["kimberly"] },
  { glyph: "watch", answers: ["watch", "watches"] },
  { glyph: "under", answers: ["under", "beneath"] },
  { glyph: "creates", answers: ["creates", "create", "makes", "make"] },
  { glyph: "chris", answers: ["chris", "christopher"] },
  { glyph: "loves", answers: ["loves", "love"] },
  { glyph: "table", answers: ["table", "desk"] },
  { glyph: "tv", answers: ["tv", "television"] },
  { glyph: "gift", answers: ["gift", "present", "gifts", "presents"] },
  { glyph: "hides", answers: ["hides", "hide"] },
];

const GUESS_ALIASES = {
  christopher: "chris",
  christoph: "chris",
  presents: "present",
  gifts: "gift",
};

// Binary-tree signatures (max depth 2 => 3 levels including root).
const WORD_TREES = {
  chris: ["", "L", "R", "LL"],
  kimberly: ["", "L", "R", "RR"],
  loves: ["", "L", "R", "LR", "RL"],
  creates: ["", "L", "R", "LL", "LR"],
  hides: ["", "L", "R", "RL", "RR"],
  gift: ["", "L", "R", "LL", "RR"],
  tv: ["", "L", "R", "LR"],
  watch: ["", "L", "R", "RL"],
  under: ["", "L", "LL"],
  table: ["", "R", "RR"],
};

// Per-edge lengths (in SVG units) make each glyph distinct even with fixed 45-degree branching.
const WORD_TREE_LENGTHS = {
  chris: { L: 20, R: 12, LL: 9 },
  kimberly: { L: 12, R: 20, RR: 9 },
  loves: { L: 16, R: 16, LR: 11, RL: 11 },
  creates: { L: 18, R: 10, LL: 12, LR: 8 },
  hides: { L: 10, R: 18, RL: 12, RR: 8 },
  gift: { L: 14, R: 14, LL: 7, RR: 13 },
  tv: { L: 9, R: 18, LR: 13 },
  watch: { L: 18, R: 9, RL: 13 },
  under: { L: 17, LL: 12 },
  table: { R: 17, RR: 12 },
};

const SVG_NS = "http://www.w3.org/2000/svg";

const clueList = document.querySelector("#clue-list");
const finalVineMount = document.querySelector("#final-vine");
const lexiconMount = document.querySelector("#lexicon-list");

function createSvgElement(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);

  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });

  return element;
}

function normalize(text) {
  return text.trim().toLowerCase().replace(/[.,!?]/g, "").replace(/\s+/g, " ");
}

function canonicalizeGuessWord(word) {
  return GUESS_ALIASES[word] || word;
}

function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[a.length][b.length];
}

function allowedDistance(word) {
  if (word.length <= 4) {
    return 1;
  }

  if (word.length <= 8) {
    return 1;
  }

  return 2;
}

function isAcceptedGuess(guess, answers) {
  const canonicalGuess = canonicalizeGuessWord(guess);
  const canonicalAnswers = [...new Set(answers.map((answer) => canonicalizeGuessWord(answer)))];

  if (canonicalAnswers.includes(canonicalGuess)) {
    return true;
  }

  return canonicalAnswers.some((answer) => {
    const maxDistance = Math.max(allowedDistance(answer), allowedDistance(canonicalGuess));
    if (Math.abs(answer.length - canonicalGuess.length) > maxDistance) {
      return false;
    }

    return editDistance(canonicalGuess, answer) <= maxDistance;
  });
}

function buildVerifyIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "verify-indicator is-idle";
  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-live", "polite");
  indicator.setAttribute("aria-label", "Unverified");

  const check = createSvgElement("svg", {
    class: "indicator-icon indicator-check",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  });
  check.appendChild(createSvgElement("path", { d: "M5 13 L10 18 L19 7" }));
  indicator.appendChild(check);

  const wrong = createSvgElement("svg", {
    class: "indicator-icon indicator-x",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  });
  wrong.appendChild(createSvgElement("path", { d: "M7 7 L17 17 M17 7 L7 17" }));
  indicator.appendChild(wrong);

  return indicator;
}

function setVerifyIndicator(indicator, state, label) {
  indicator.classList.remove("is-idle", "is-correct", "is-wrong", "animate");
  // Force a reflow so the state animation can replay on repeated checks.
  void indicator.offsetWidth;
  indicator.classList.add(state, "animate");
  indicator.setAttribute("aria-label", label);
}

function buildLoveHeartGlyph() {
  const group = createSvgElement("g", {
    class: "heart-glyph",
  });

  group.appendChild(
    createSvgElement("path", {
      class: "heart-root",
      d: "M 0 0 L 0 5.5",
    })
  );

  group.appendChild(
    createSvgElement("path", {
      class: "heart-edge",
      d: "M 0 0 C -7 -7 -18 -14 -18 -24 C -18 -31 -13 -36 -7 -36 C -3 -36 0 -34 0 -29 C 0 -34 3 -36 7 -36 C 13 -36 18 -31 18 -24 C 18 -14 7 -7 0 0",
    })
  );

  return group;
}

function buildBinaryTreeGlyph(token) {
  if (token === "loves") {
    return buildLoveHeartGlyph();
  }

  const signature = new Set((WORD_TREES[token] || ["", "L", "R"]).map((path) => path.toUpperCase()));
  const lengthProfile = WORD_TREE_LENGTHS[token] || {};
  signature.add("");

  const nodes = {
    "": {
      x: 0,
      y: 0,
      angle: -90,
    },
  };
  const edges = [];
  const queue = [""];

  while (queue.length > 0) {
    const parentPath = queue.shift();
    const parent = nodes[parentPath];
    const depth = parentPath.length;

    if (depth >= 2) {
      continue;
    }

    ["L", "R"].forEach((side) => {
      const childPath = `${parentPath}${side}`;
      if (!signature.has(childPath)) {
        return;
      }

      // Exact binary-branch turn: every split is +/-45 degrees from its parent direction.
      const angle = parent.angle + (side === "L" ? -45 : 45);
      const defaultLength = childPath.length === 1 ? 14 : 10;
      const length = Number(lengthProfile[childPath] || defaultLength);
      const radians = (angle * Math.PI) / 180;
      const childNode = {
        x: parent.x + Math.cos(radians) * length,
        y: parent.y + Math.sin(radians) * length,
        angle,
      };

      nodes[childPath] = childNode;
      edges.push([parentPath, childPath]);
      queue.push(childPath);
    });
  }

  const group = createSvgElement("g", {
    class: "tree-glyph",
  });

  // Tiny root tail helps the glyph read as grown from the branch tip.
  group.appendChild(
    createSvgElement("path", {
      class: "tree-root",
      d: "M 0 0 L 0 5.5",
    })
  );

  edges.forEach(([fromPath, toPath]) => {
    const fromNode = nodes[fromPath];
    const toNode = nodes[toPath];
    group.appendChild(
      createSvgElement("path", {
        class: "tree-edge",
        d: `M ${fromNode.x.toFixed(2)} ${fromNode.y.toFixed(2)} L ${toNode.x.toFixed(2)} ${toNode.y.toFixed(2)}`,
      })
    );
  });

  const isLeaf = (path) => !signature.has(`${path}L`) && !signature.has(`${path}R`);
  Object.entries(nodes).forEach(([path, node]) => {
    if (path === "") {
      return;
    }

    group.appendChild(
      createSvgElement("circle", {
        class: isLeaf(path) ? "tree-tip-node" : "tree-node",
        cx: node.x.toFixed(2),
        cy: node.y.toFixed(2),
        r: isLeaf(path) ? "1.1" : "1.4",
      })
    );
  });

  return group;
}

function buildVineSentence(words, ariaLabel) {
  const shell = document.createElement("div");
  shell.className = "vine-shell";

  const width = Math.max(360, 140 + words.length * 120);
  const height = 160;
  const startX = 24;
  const endX = width - 24;
  const baselineY = 118;

  const svg = createSvgElement("svg", {
    class: "vine-svg",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": ariaLabel,
  });

  const baseline = `M ${startX.toFixed(2)} ${baselineY.toFixed(2)} L ${endX.toFixed(2)} ${baselineY.toFixed(2)}`;
  svg.appendChild(createSvgElement("path", { class: "vine-main", d: baseline }));
  svg.appendChild(createSvgElement("path", { class: "vine-main vine-main-echo", d: baseline }));

  const spread = endX - startX;

  words.forEach((token, index) => {
    const t = (index + 1) / (words.length + 1);
    const anchorX = startX + spread * t;
    const stemHeight = 14;
    const stemTopY = baselineY - stemHeight;
    const stemPath = `M ${anchorX.toFixed(2)} ${baselineY.toFixed(2)} L ${anchorX.toFixed(2)} ${stemTopY.toFixed(2)}`;
    svg.appendChild(createSvgElement("path", { class: "sentence-stem", d: stemPath }));

    const glyphScale = 1.24;
    const glyphGroup = createSvgElement("g", {
      class: "vine-glyph-wrap",
      transform: `translate(${anchorX.toFixed(2)} ${stemTopY.toFixed(2)}) scale(${glyphScale.toFixed(3)})`,
    });

    glyphGroup.appendChild(buildBinaryTreeGlyph(token));
    svg.appendChild(glyphGroup);
  });

  shell.appendChild(svg);
  return shell;
}

function buildGlyphSwatch(token) {
  const svg = createSvgElement("svg", {
    class: "glyph-swatch",
    viewBox: "0 0 100 100",
    role: "img",
    "aria-label": "Unknown glyph word",
  });

  svg.appendChild(
    createSvgElement("path", {
      class: "glyph-swatch-frame",
      d: "M14 53 C16 31, 32 16, 53 18 C77 20, 88 35, 86 57 C84 76, 66 88, 45 86 C25 84, 12 72, 14 53 Z",
    })
  );

  const glyphWrap = createSvgElement("g", {
    class: "glyph-swatch-tree",
    transform: "translate(50 78) scale(1.02)",
  });
  glyphWrap.appendChild(buildBinaryTreeGlyph(token));
  svg.appendChild(glyphWrap);

  return svg;
}

function attachClueImage(image, baseFilename, imageBox) {
  image.src = `assets/clues/${baseFilename}.png`;
  image.dataset.fallback = "webp";

  image.addEventListener("error", () => {
    if (image.dataset.fallback === "webp") {
      image.dataset.fallback = "jpg";
      image.src = `assets/clues/${baseFilename}.webp`;
      return;
    }

    if (image.dataset.fallback === "jpg") {
      image.dataset.fallback = "done";
      image.src = `assets/clues/${baseFilename}.jpg`;
      return;
    }

    image.remove();
    const placeholder = document.createElement("p");
    placeholder.className = "placeholder-note";
    placeholder.textContent = "";
    imageBox.appendChild(placeholder);
  });
}

function buildClueCards() {
  const fragment = document.createDocumentFragment();

  clues.forEach((clue, index) => {
    const card = document.createElement("article");
    card.className = "clue-card";
    card.style.animationDelay = `${index * 70}ms`;

    const imageBox = document.createElement("div");
    imageBox.className = "clue-image";

    const image = document.createElement("img");
    image.alt = `Image clue ${clue.id}`;
    image.loading = "lazy";
    attachClueImage(image, clue.filename, imageBox);

    imageBox.appendChild(image);
    card.appendChild(imageBox);
    card.appendChild(buildVineSentence(clue.words, `Vine sentence for clue ${clue.id}`));
    fragment.appendChild(card);
  });

  clueList.appendChild(fragment);
}

function buildLexiconVerifier() {
  const fragment = document.createDocumentFragment();

  verifierLexicon.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "lexicon-row";

    const glyph = document.createElement("div");
    glyph.className = "glyph-word";
    glyph.appendChild(buildGlyphSwatch(entry.glyph));
    row.appendChild(glyph);

    const input = document.createElement("input");
    input.className = "guess-input";
    input.type = "text";
    input.placeholder = "Guess meaning";
    input.setAttribute("aria-label", `Guess for glyph ${entry.glyph}`);
    row.appendChild(input);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Verify";
    button.setAttribute("aria-label", "Verify guess");
    row.appendChild(button);

    const status = buildVerifyIndicator();
    row.appendChild(status);

    function runCheck() {
      const guess = normalize(input.value);
      input.classList.remove("is-correct", "is-wrong");

      if (!guess) {
        input.classList.add("is-wrong");
        setVerifyIndicator(status, "is-wrong", "Add a guess first");
        return;
      }

      if (isAcceptedGuess(guess, entry.answers)) {
        input.classList.add("is-correct");
        setVerifyIndicator(status, "is-correct", "Correct");
      } else {
        input.classList.add("is-wrong");
        setVerifyIndicator(status, "is-wrong", "Not this one yet");
      }
    }

    button.addEventListener("click", runCheck);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runCheck();
      }
    });

    fragment.appendChild(row);
  });

  lexiconMount.appendChild(fragment);
}

function mountFinalVine() {
  finalVineMount.appendChild(buildVineSentence(finalWords, "Final vine sentence"));
}

buildClueCards();
mountFinalVine();
buildLexiconVerifier();
