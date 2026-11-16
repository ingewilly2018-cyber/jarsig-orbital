import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(".");
const BUILD = path.join(ROOT, ".pptx-build");
const OUTDIR = path.join(ROOT, "deliverables");
const FINAL = path.join(OUTDIR, "JARSIG_NASA_5_Slide_Briefing_Final.pptx");
const SKILL = "C:/Users/Willy/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/presentations";
const { resolvePresentationFont } = await import(pathToFileURL(path.join(SKILL, "container_tools/artifact_tool_utils.mjs")).href);
const FONT = resolvePresentationFont({ fontFamily: "Arial" });

const W = 1280, H = 720;
const C = {
  bg: "#07111B", bg2: "#0C1B29", bg3: "#102536",
  white: "#F4F7FA", muted: "#A9BAC7", dim: "#708594",
  gold: "#F5C451", cyan: "#70D7E8", line: "#294151",
  green: "#9CD6B2",
};
const ppt = Presentation.create({ slideSize: { width: W, height: H } });

function rect(slide, x, y, w, h, fill, opts = {}) {
  return slide.shapes.add({
    geometry: opts.geometry ?? "rect",
    name: opts.name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: opts.stroke ? { style: "solid", fill: opts.stroke, width: opts.strokeWidth ?? 1 } : { style: "solid", fill: "none", width: 0 },
    ...(opts.radius ? { borderRadius: opts.radius } : {}),
  });
}
function text(slide, value, x, y, w, h, opts = {}) {
  const s = slide.shapes.add({
    geometry: "textbox",
    name: opts.name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  s.text = value;
  s.text.style = {
    typeface: FONT,
    fontSize: opts.size ?? 22,
    bold: opts.bold ?? false,
    color: opts.color ?? C.white,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    autoFit: "shrinkText",
    insets: 0,
    ...(opts.italic ? { italic: true } : {}),
  };
  if (opts.link) s.hyperlink = { uri: opts.link, isExternal: true };
  return s;
}
function line(slide, x, y, w, h = 2, color = C.line) {
  return rect(slide, x, y, w, h, color);
}
function base(title, kicker, page) {
  const s = ppt.slides.add();
  s.background.fill = C.bg;
  rect(s, 0, 0, W, 8, C.gold);
  text(s, "JARSIG ORBITAL  /  NASA BRIEFING", 64, 30, 480, 23, { size: 14, bold: true, color: C.muted });
  text(s, kicker.toUpperCase(), 64, 75, 600, 20, { size: 14, bold: true, color: C.cyan });
  text(s, title, 64, 107, 1140, 64, { size: 44, bold: true });
  line(s, 64, 664, 1152, 1, C.line);
  text(s, "Independent prototype · Not a NASA product or certified mission-planning system", 64, 679, 980, 20, { size: 12, color: C.dim });
  text(s, String(page).padStart(2, "0"), 1165, 678, 50, 20, { size: 13, color: C.dim, align: "right" });
  return s;
}
function node(slide, x, y, w, h, heading, body, color = C.cyan, link = undefined) {
  rect(slide, x, y, w, h, C.bg2, { radius: 8, stroke: C.line });
  rect(slide, x, y, 5, h, color);
  text(slide, heading, x + 22, y + 18, w - 42, 31, { size: 24, bold: true });
  text(slide, body, x + 22, y + 58, w - 42, h - (link ? 105 : 72), { size: 18, color: C.muted });
  if (link) text(slide, "OPEN SOURCE ↗", x + 22, y + h - 31, w - 42, 18, { size: 12, bold: true, color: C.cyan, link });
}
function notes(slide, ...rows) {
  slide.speakerNotes.text = rows.join("\n");
}
function linkText(slide, label, url, x, y, w) {
  return text(slide, label + " ↗", x, y, w, 24, { size: 15, color: C.cyan, link: url });
}

// 1 — Project framing + an editable, explanatory system diagram.
{
  const s = ppt.slides.add();
  s.background.fill = C.bg;
  rect(s, 0, 0, W, 9, C.gold);
  text(s, "INDEPENDENT LUNAR EXPLORATION PROTOTYPE", 72, 54, 740, 24, { size: 15, bold: true, color: C.cyan });
  text(s, "Lunar mission\nplanning", 72, 112, 675, 164, { size: 68, bold: true });
  text(s, "Surface context. Local sky visibility. Landing practice.", 76, 302, 620, 45, { size: 26, color: C.white });
  text(s, "JARSIG brings public lunar data and a simple mission workflow into one web experience.", 76, 365, 548, 76, { size: 21, color: C.muted });
  rect(s, 76, 492, 510, 1, C.line);
  text(s, "A prototype for discussion — not an operational tool.", 76, 514, 535, 30, { size: 17, color: C.gold, bold: true });
  linkText(s, "PROJECT REPOSITORY", "https://github.com/ingewilly2018-cyber/jarsig-orbital", 76, 590, 360);

  // System diagram: data streams are shown as inputs to the prototype.
  text(s, "ONE WORKSPACE · THREE COMPLEMENTARY VIEWS", 760, 94, 455, 24, { size: 14, bold: true, color: C.muted });
  node(s, 764, 147, 435, 112, "Lunar surface", "NASA/JPL LRO WAC map and 3D globe", C.gold);
  node(s, 764, 286, 435, 112, "Sun & Earth", "JPL Horizons observer ephemerides", C.cyan);
  node(s, 764, 425, 435, 112, "Mission practice", "Reference sites, briefings and a teaching simulation", C.green);
  rect(s, 726, 195, 20, 3, C.gold); rect(s, 726, 334, 20, 3, C.cyan); rect(s, 726, 473, 20, 3, C.green);
  rect(s, 704, 195, 3, 279, C.line);
  text(s, "JARSIG", 772, 570, 220, 45, { size: 34, bold: true, color: C.white });
  text(s, "Open-source prototype", 928, 580, 270, 28, { size: 18, color: C.muted });
  notes(s,
    "Introduce JARSIG as an independent prototype built to explore how public lunar data can support an understandable site-planning workflow.",
    "The application is not affiliated with or endorsed by NASA and is not a certified operational mission-planning system.",
    "Sources: NASA Moon Trek https://trek.nasa.gov/moon/ ; JPL Horizons https://ssd-api.jpl.nasa.gov/doc/horizons.html ; project https://github.com/ingewilly2018-cyber/jarsig-orbital");
}

// 2 — User workflow.
{
  const s = base("A short workflow from coordinates to practice", "How it works", 2);
  text(s, "Choose a reference site or click the lunar map; carry that same point into analysis and simulation.", 64, 186, 1060, 38, { size: 21, color: C.muted });
  const xs = [70, 365, 660, 955];
  const items = [
    ["01", "Select a site", "Pan and zoom the NASA/JPL lunar map; select coordinates or load a south-pole reference."],
    ["02", "Set the interval", "Choose the UTC start time and analysis duration for the selected surface point."],
    ["03", "Inspect the sky", "Review sampled Sun/Earth azimuth, elevation and estimated above-horizon windows."],
    ["04", "Compare & rehearse", "Save a browser-side analysis, compare cases, or try the separate landing simulator."],
  ];
  for (let i = 0; i < items.length; i++) {
    const [num, head, body] = items[i];
    rect(s, xs[i], 264, 244, 2, i === 0 ? C.gold : C.line);
    text(s, num, xs[i], 285, 70, 54, { size: 36, bold: true, color: i === 0 ? C.gold : C.cyan });
    text(s, head, xs[i], 354, 245, 36, { size: 25, bold: true });
    text(s, body, xs[i], 403, 244, 120, { size: 18, color: C.muted });
    if (i < 3) {
      rect(s, xs[i] + 250, 285, 34, 2, C.line);
      text(s, "›", xs[i] + 259, 264, 32, 37, { size: 32, color: C.gold, align: "center" });
    }
  }
  rect(s, 64, 556, 1152, 71, C.bg2, { radius: 8, stroke: C.line });
  text(s, "Example reference", 84, 573, 190, 25, { size: 15, bold: true, color: C.gold });
  text(s, "Haworth · 86.768° S, 20.514° W", 284, 570, 450, 32, { size: 22, bold: true });
  text(s, "Representative point in the app's published-site list; not a selected landing site.", 720, 574, 465, 44, { size: 16, color: C.muted });
  notes(s,
    "Walk through the same point across map selection, time selection, Horizons analysis, comparison and the separate teaching simulator.",
    "The example Haworth coordinates are the values currently present in src/lib/lunar-sites.ts and are described there as representative points from the cited candidate-site study. Do not describe them as official final landing coordinates.",
    "Sources: NASA candidate regions https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ ; study DOI https://doi.org/10.1029/2025JE009434 ; project source https://github.com/ingewilly2018-cyber/jarsig-orbital");
}

// 3 — Real data services, concise system architecture.
{
  const s = base("NASA/JPL data connected to the user workflow", "Data integration", 3);
  text(s, "Public sources feed specific features; the prototype keeps outputs traceable to their source.", 64, 185, 1070, 36, { size: 21, color: C.muted });
  node(s, 64, 246, 264, 221, "Moon Trek", "LRO WAC imagery\nWMTS surface tiles\nMap + 3D globe", C.gold, "https://trek.nasa.gov/moon/");
  node(s, 352, 246, 264, 221, "JPL Horizons", "Observer API\nSun & Earth at chosen coordinates\nAzimuth / elevation samples", C.cyan, "https://ssd-api.jpl.nasa.gov/doc/horizons.html");
  node(s, 640, 246, 264, 221, "NASA feeds", "Artemis RSS\nLaunch schedule page\nNASA image library", C.green, "https://www.nasa.gov/blogs/missions/");
  node(s, 928, 246, 288, 221, "JARSIG interface", "Interactive map\nSky analysis and charts\nMission bulletins", C.gold, "https://github.com/ingewilly2018-cyber/jarsig-orbital");
  for (const x of [328, 616, 904]) {
    rect(s, x + 4, 355, 14, 2, C.line);
    text(s, "›", x + 12, 336, 23, 37, { size: 30, bold: true, color: C.gold, align: "center" });
  }
  text(s, "The app also reads Natural Earth country outlines for an illustrative overlay; those boundaries are not lunar territories or NASA data.", 64, 502, 1125, 40, { size: 17, color: C.muted });
  linkText(s, "MOON TREK", "https://trek.nasa.gov/moon/", 64, 578, 200);
  linkText(s, "HORIZONS API DOCS", "https://ssd-api.jpl.nasa.gov/doc/horizons.html", 284, 578, 250);
  linkText(s, "ARTEMIS III REGION UPDATE", "https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/", 554, 578, 480);
  notes(s,
    "Moon Trek's published interface lists the LRO WAC global mosaic and supports lunar map and globe views. JARSIG requests Moon Trek tile imagery for its map and globe.",
    "The server calls the JPL Horizons API for observer ephemerides of the Sun and Earth from coordinates entered by the user. In the current implementation it samples hourly.",
    "The mission page reads NASA's Artemis RSS and launch schedule page and exposes NASA Image and Video Library search. NASA schedule dates may move.",
    "The country outline overlay comes from Natural Earth, not NASA, and is only a visual aid.",
    "Sources: Moon Trek https://trek.nasa.gov/moon/ ; Horizons API https://ssd-api.jpl.nasa.gov/doc/horizons.html ; NASA Artemis regions https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ ; NASA Image Library https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf ; Natural Earth https://www.naturalearthdata.com/");
}

// 4 — What the scientific page provides and its assumptions.
{
  const s = base("Useful visibility context — with clear limits", "Scientific outputs", 4);
  text(s, "For a chosen lunar surface point and UTC interval, JARSIG returns a compact, inspectable Horizons result.", 64, 184, 1110, 38, { size: 21, color: C.muted });

  text(s, "INPUTS", 72, 252, 190, 22, { size: 14, bold: true, color: C.gold });
  text(s, "Latitude · east longitude · altitude\nUTC start time · 1–168 hour duration", 72, 290, 438, 75, { size: 22, bold: true });
  rect(s, 530, 314, 45, 3, C.gold); text(s, "›", 567, 294, 30, 36, { size: 32, color: C.gold, align: "center" });
  text(s, "JPL HORIZONS", 620, 252, 250, 22, { size: 14, bold: true, color: C.cyan });
  text(s, "Observer ephemerides\nHourly Sun/Earth samples", 620, 290, 290, 75, { size: 22, bold: true });
  rect(s, 918, 314, 45, 3, C.gold); text(s, "›", 955, 294, 30, 36, { size: 32, color: C.gold, align: "center" });
  text(s, "OUTPUTS", 1008, 252, 200, 22, { size: 14, bold: true, color: C.green });
  text(s, "Azimuth & elevation\nEstimated horizon windows\nSaved / compared cases", 1008, 290, 210, 120, { size: 20, bold: true });

  rect(s, 64, 430, 1152, 1, C.line);
  text(s, "Current model boundaries", 64, 455, 360, 34, { size: 24, bold: true });
  const limits = [
    ["Hourly sampling", "Visibility windows are estimates between discrete samples."],
    ["Geometric horizon", "No local terrain or crater-rim masking is applied."],
    ["Training simulation", "The landing game is educational, separate from Horizons."],
  ];
  const lx = [64, 454, 844];
  for (let i = 0; i < limits.length; i++) {
    text(s, limits[i][0], lx[i], 510, 340, 27, { size: 18, bold: true, color: i === 0 ? C.gold : C.white });
    text(s, limits[i][1], lx[i], 545, 340, 68, { size: 17, color: C.muted });
  }
  linkText(s, "HORIZONS API PARAMETERS", "https://ssd-api.jpl.nasa.gov/doc/horizons.html", 64, 618, 320);
  notes(s,
    "The scientific page accepts latitude, longitude, altitude, UTC start and duration up to 168 hours. It asks Horizons for observer ephemerides of the Sun and Earth.",
    "The app samples at one-hour steps and reports azimuth/elevation and intervals where elevation is above zero. These are geometric estimates; local terrain shadowing and panel performance are not modeled. The separate lander game is pedagogical.",
    "Source: JPL Horizons API documentation https://ssd-api.jpl.nasa.gov/doc/horizons.html ; implementation https://github.com/ingewilly2018-cyber/jarsig-orbital");
}

// 5 — Concrete review request and useful links.
{
  const s = base("A focused path to a more mission-relevant prototype", "Discussion & next steps", 5);
  text(s, "The current build is a usable data-exploration prototype. The next gains depend on validation against mission-grade products.", 64, 184, 1110, 56, { size: 21, color: C.muted });
  const asks = [
    ["1", "Validate coordinate conventions", "Review lunar reference frames, longitude direction, altitude assumptions and sample timing."],
    ["2", "Prioritize surface layers", "Identify the right illumination, elevation, slope and hazard products for a next iteration."],
    ["3", "Define a test set", "Compare selected sites and visibility outputs against trusted reference cases."],
  ];
  const ys = [278, 376, 474];
  for (let i = 0; i < asks.length; i++) {
    const [n, title, body] = asks[i];
    text(s, n, 70, ys[i], 52, 48, { size: 34, bold: true, color: C.gold });
    text(s, title, 136, ys[i] + 2, 365, 32, { size: 23, bold: true });
    text(s, body, 510, ys[i] + 3, 645, 52, { size: 18, color: C.muted });
    if (i < asks.length - 1) rect(s, 136, ys[i] + 72, 1015, 1, C.line);
  }
  rect(s, 64, 571, 1152, 1, C.line);
  linkText(s, "JARSIG SOURCE", "https://github.com/ingewilly2018-cyber/jarsig-orbital", 64, 603, 230);
  linkText(s, "NASA SOUTH POLE VISUALS", "https://www.nasa.gov/gallery/lunar-south-pole-visualizations/", 320, 603, 340);
  linkText(s, "ARTEMIS LANDING REGION UPDATE", "https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/", 690, 603, 480);
  notes(s,
    "Close by asking for feedback, not for endorsement: which coordinate conventions and data layers should be validated first, and what reference cases would make a useful evaluation set?",
    "NASA's 2024 Artemis III communication described nine candidate regions near the lunar South Pole and said those regions would continue to be investigated. Do not characterize this prototype as part of NASA's site-selection process.",
    "Sources: NASA South Pole visualizations https://www.nasa.gov/gallery/lunar-south-pole-visualizations/ ; Artemis III candidate-region update https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ ; NASA NTRS https://ntrs.nasa.gov/citations/20250011660 ; JARSIG source https://github.com/ingewilly2018-cyber/jarsig-orbital");
}

await fs.mkdir(BUILD, { recursive: true });
await fs.mkdir(OUTDIR, { recursive: true });
const expectedSlides = 5;
if (ppt.slides.items.length !== expectedSlides) throw new Error(`Expected ${expectedSlides} slides, found ${ppt.slides.items.length}`);

for (const [i, slide] of ppt.slides.items.entries()) {
  const png = await ppt.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(BUILD, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}
const candidate = path.join(BUILD, "candidate.pptx");
await (await PresentationFile.exportPptx(ppt)).save(candidate);

const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL, "container_tools/artifact_tool_utils.mjs")).href);
const result = await finalizePresentation({
  explicitTotalSlideCount: expectedSlides,
  workspaceDir: ROOT,
  candidatePath: candidate,
  finalPath: FINAL,
  pythonExecutable: "C:/Users/Willy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(SKILL, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [FONT] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(BUILD, "validation-final.json"),
});
console.log(JSON.stringify({ finalPath: FINAL, font: FONT, slideCount: ppt.slides.items.length, finalizer: result }, null, 2));
