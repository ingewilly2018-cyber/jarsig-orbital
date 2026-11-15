import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Site access — JARSIG" }, { name: "description", content: "Open the JARSIG exploration site." }] }),
  beforeLoad: () => { throw redirect({ to: "/play" }); },
});
