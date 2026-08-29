import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

export function BoardPane({
  onApiReady,
  onSceneChange,
}: {
  onApiReady: (api: ExcalidrawImperativeAPI) => void;
  onSceneChange: () => void;
}) {
  return (
    <div className="h-full min-h-0 [&_.excalidraw]:!font-sans [&_.zoom-actions]:!hidden [&_.undo-redo-buttons]:!hidden">
      <Excalidraw
        excalidrawAPI={onApiReady}
        onChange={onSceneChange}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: null,
          },
        }}
      />
    </div>
  );
}
