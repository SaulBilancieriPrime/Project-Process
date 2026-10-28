import { createFileRoute } from "@tanstack/react-router";
import App from "../App";

export const Route = createFileRoute("/")({
  ssr: false,
  component: GraphPage,
});

function GraphPage() {
  return (
    <div className="h-screen overflow-hidden">
      <App />
    </div>
  );
}
