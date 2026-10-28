import type { ArrowStyle } from "../types";
import LinkMenuOptions from "./LinkMenuOptions";
import SizePresetPicker from "./SizePresetPicker";

type Props = {
  accent?: string;
  onAddNode: (size: number) => void;
  onLink: (arrows: ArrowStyle) => void;
};

export default function AddGraphActions({ accent, onAddNode, onLink }: Props) {
  return (
    <>
      <div className="mx-1 mt-0.5 mb-0.5 text-[9px] font-bold tracking-wider text-[var(--muted)] uppercase">
        Add node
      </div>
      <div className="px-0.5">
        <SizePresetPicker compact accent={accent} onSelect={onAddNode} />
      </div>
      <LinkMenuOptions compact onLink={onLink} />
    </>
  );
}
