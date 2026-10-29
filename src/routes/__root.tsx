import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { ReactNode } from "react";
import StoreDevtools from "../store/devtools";
import appCss from "../styles.css?url";

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('project-process.theme');var mode=stored==='light'?'light':'dark';document.documentElement.setAttribute('data-theme',mode);var moved=window.localStorage.getItem('project-process.devtools-trigger');if(moved!=='bottom-center'){var key='tanstack_devtools_settings';var raw=window.localStorage.getItem(key);var settings=raw?JSON.parse(raw):{};settings.triggerMode='floating';settings.triggerCoords={x:50,y:100};delete settings.triggerCorner;delete settings.triggerEdge;window.localStorage.setItem(key,JSON.stringify(settings));window.localStorage.setItem('project-process.devtools-trigger','bottom-center');}}catch(e){}})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "NEXUS | Project Process" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            triggerMode: "floating",
            triggerCoords: { x: 50, y: 100 },
          }}
          plugins={[
            { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
            StoreDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
