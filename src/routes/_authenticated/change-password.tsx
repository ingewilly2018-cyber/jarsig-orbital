import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/change-password")({
  beforeLoad: () => { throw redirect({ to: "/play" }); },
  component: () => null,
});
