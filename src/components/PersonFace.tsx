import { useEffect, useState } from "react";
import { personStyle, type PersonIcon } from "../data/personStyle";
import { loadPersonPhoto } from "../lib/personPhoto";
import { cx } from "../styles";

function Icon({ kind }: { kind: PersonIcon }) {
  const common = { viewBox: "0 0 12 12", className: "block size-[14px] fill-[#1a1208]", "aria-hidden": true as const };
  switch (kind) {
    case "star":
      return <svg {...common}><polygon points="6,1 7.4,4.6 11,4.8 8.2,7.2 9.1,11 6,9 2.9,11 3.8,7.2 1,4.8 4.6,4.6" /></svg>;
    case "diamond":
      return <svg {...common}><polygon points="6,1.2 10.6,6 6,10.8 1.4,6" /></svg>;
    case "shield":
      return <svg {...common}><path d="M6 1.2l4.4 1.6v3.4c0 2.5-1.9 4.2-4.4 5.2C3.5 10.4 1.6 8.7 1.6 6.2V2.8L6 1.2z" /></svg>;
    case "triangle":
      return <svg {...common}><polygon points="6,1.4 11,10.6 1,10.6" /></svg>;
    case "hex":
      return <svg {...common}><polygon points="6,1.2 10.2,3.4 10.2,8.6 6,10.8 1.8,8.6 1.8,3.4" /></svg>;
    case "square":
      return <svg {...common}><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1" /></svg>;
    case "bolt":
      return <svg {...common}><polygon points="7.2,1 3,6.8 5.6,6.8 4.8,11 9.2,5.2 6.4,5.2" /></svg>;
    case "leaf":
      return <svg {...common}><path d="M10.4 1.8C6.2 2 2.4 5.2 2.2 9.6c2.2.4 5.6-1 7.2-3.2 1.2-1.6 1.4-3.6 1-4.6z" /></svg>;
    case "plus":
      return <svg {...common}><path d="M5.2 1.6h1.6v3.6h3.6v1.6H6.8v3.6H5.2V6.8H1.6V5.2h3.6z" /></svg>;
    default:
      return <svg {...common}><circle cx="6" cy="6" r="3.4" /></svg>;
  }
}

type Props = {
  name: string;
  email?: string;
  className?: string;
};

export default function PersonFace({ name, email = "", className }: Props) {
  const { color, icon } = personStyle(email || name);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    let alive = true;
    loadPersonPhoto(email).then((url) => {
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [email]);

  return (
    <span
      className={cx("relative inline-flex size-full items-center justify-center overflow-hidden rounded-full", className)}
      style={{ background: color }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute top-[32%] left-1/2 h-[175%] w-[175%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover object-[center_20%]"
        />
      ) : (
        <Icon kind={icon} />
      )}
    </span>
  );
}
