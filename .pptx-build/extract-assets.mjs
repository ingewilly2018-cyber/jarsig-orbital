import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(".");
const BUILD = path.join(ROOT, ".pptx-build");
const OUTDIR = path.join(ROOT, "deliverables");
const FINAL = path.join(OUTDIR, "JARSIG_Logo_Orb_Editable_Final.pptx");
const SKILL = "C:/Users/Willy/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/presentations";
const { resolvePresentationFont } = await import(pathToFileURL(path.join(SKILL, "container_tools/artifact_tool_utils.mjs")).href);
const FONT = resolvePresentationFont({ fontFamily: "Arial" });
const ppt = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = ppt.slides.add();
slide.background.fill = "#000000";

const word = slide.shapes.add({
  geometry: "textbox",
  name: "JARSIG — editable wordmark",
  position: { left: 168, top: 275, width: 470, height: 125 },
  fill: "none",
  line: { style: "solid", fill: "none", width: 0 },
});
word.text = "JARSIG";
word.text.style = {
  typeface: FONT,
  fontSize: 106,
  color: "#02A9DF",
  bold: false,
  alignment: "left",
  verticalAlignment: "middle",
  autoFit: "shrinkText",
  insets: 0,
};
word.text.fill = {
  type: "gradient",
  gradientKind: "linear",
  angleDeg: 0,
  stops: [
    { offset: 0, color: "#05B7D7" },
    { offset: 100000, color: "#1767D6" },
  ],
};

const cx = 890, cy = 425, rx = 210, ry = 210;
const latitudes = [];
for (let lat = -1.27; lat <= 1.271; lat += 0.16) latitudes.push(lat);
let dotIndex = 0;

for (const lat of latitudes) {
  const cosLat = Math.cos(lat);
  const count = Math.max(7, Math.round(34 * cosLat));
  for (let i = 0; i < count; i++) {
    // Keep the front hemisphere and distribute each latitude across its visible arc.
    const longitude = -Math.PI / 2 + (i + 0.5) / count * Math.PI;
    const xUnit = cosLat * Math.sin(longitude);
    const yUnit = Math.sin(lat);
    const zUnit = cosLat * Math.cos(longitude);
    const x = cx + rx * xUnit;
    const y = cy - ry * yUnit;

    // Softly shade the editable dots to retain the luminous halftone globe appearance.
    const illumination = Math.max(0, -0.48 * xUnit - 0.12 * yUnit + 0.87 * zUnit);
    const edge = Math.min(1, Math.max(0.42, (zUnit + 0.10) * 0.88));
    const intensity = Math.max(0.38, Math.min(1, 0.34 + illumination * 0.72)) * edge;
    const gray = Math.round(96 + intensity * 159);
    const color = `#${gray.toString(16).padStart(2, "0").repeat(3)}`;
    const diameter = 2.1 + intensity * 1.8;
    dotIndex++;
    slide.shapes.add({
      geometry: "ellipse",
      name: `Boule — point ${String(dotIndex).padStart(3, "0")}`,
      position: { left: x - diameter / 2, top: y - diameter / 2, width: diameter, height: diameter },
      fill: color,
      line: { style: "solid", fill: "none", width: 0 },
    });
  }
}

slide.speakerNotes.text = [
  "JARSIG is an editable PowerPoint text object.",
  `The dotted globe is reconstructed as ${dotIndex} individual editable vector circles. Drag a selection around the globe to select its dots; use Ctrl+G in PowerPoint to group them, or Ungroup to edit individual points.`,
  "The positions and dot shading are a vector reconstruction based on the supplied screenshot, not a pixel-perfect extraction.",
];

await fs.mkdir(BUILD, { recursive: true });
await fs.mkdir(OUTDIR, { recursive: true });
for (const [i, currentSlide] of ppt.slides.items.entries()) {
  const png = await ppt.export({ slide: currentSlide, format: "png", scale: 1 });
  await fs.writeFile(path.join(BUILD, `editable-assets-${i + 1}.png`), new Uint8Array(await png.arrayBuffer()));
}
const candidate = path.join(BUILD, "editable-assets-candidate.pptx");
await (await PresentationFile.exportPptx(ppt)).save(candidate);
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL, "container_tools/artifact_tool_utils.mjs")).href);
const result = await finalizePresentation({
  explicitTotalSlideCount: 1,
  workspaceDir: ROOT,
  candidatePath: candidate,
  finalPath: FINAL,
  pythonExecutable: "C:/Users/Willy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(SKILL, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [FONT] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(BUILD, "editable-assets-final-validation.json"),
});
console.log(JSON.stringify({ finalPath: FINAL, font: FONT, dotCount: dotIndex, result }, null, 2));
