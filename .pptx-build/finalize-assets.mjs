import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = path.resolve(".");
const SKILL = "C:/Users/Willy/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/presentations";
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL, "container_tools/artifact_tool_utils.mjs")).href);
const result = await finalizePresentation({
  explicitTotalSlideCount: 1,
  workspaceDir: ROOT,
  candidatePath: path.join(ROOT, ".pptx-build/editable-assets-candidate.pptx"),
  finalPath: path.join(ROOT, "deliverables/JARSIG_Logo_Orb_Editable_Final.pptx"),
  pythonExecutable: "C:/Users/Willy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(SKILL, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: ["Arial"] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(ROOT, ".pptx-build/editable-assets-final-validation.json"),
});
console.log(JSON.stringify({ output: result.finalPath, integrity: result.packageIntegrity.status, layout: result.presentationLayout.finding_count, imported: result.firstPartyImport.passed }));
