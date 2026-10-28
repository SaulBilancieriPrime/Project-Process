import type { ArrowStyle } from "../types";
import AddGraphActions from "./AddGraphActions";

type Props = {
  accent?: string;
  onAddNode: (size: number) => void;
  onLink: (arrows: ArrowStyle) => void;
  onClose: () => void;
};

export default function PlusMenu({ accent, onAddNode, onLink, onClose }: Props) {
  return (
    <AddGraphActions
      accent={accent}
      onAddNode={(size) => {
        onAddNode(size);
        onClose();
      }}
      onLink={(arrows) => {
        onLink(arrows);
        onClose();
      }}
    />
  );
}
