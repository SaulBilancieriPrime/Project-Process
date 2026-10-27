import type { ArrowStyle } from "../types";
import { menuItem } from "../styles";
import LinkMenuOptions from "./LinkMenuOptions";

type Props = {
  onAddNode: () => void;
  onLink: (arrows: ArrowStyle) => void;
  onClose: () => void;
};

export default function PlusMenu({ onAddNode, onLink, onClose }: Props) {
  return (
    <>
      <button
        type="button"
        className={menuItem}
        onClick={() => {
          onAddNode();
          onClose();
        }}
      >
        Add node
      </button>
      <LinkMenuOptions
        onLink={(arrows) => {
          onLink(arrows);
          onClose();
        }}
      />
    </>
  );
}
