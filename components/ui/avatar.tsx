import type { ImgHTMLAttributes } from "react";

const gradients = [
  "from-violet-500 to-sky-400",
  "from-fuchsia-500 to-amber-400",
  "from-cyan-500 to-emerald-400",
  "from-indigo-500 to-pink-400",
];

function gradientFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return gradients[hash % gradients.length];
}

const sizes = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
  xl: "size-24 text-xl",
};

export function Avatar({
  id,
  name,
  image,
  size = "md",
  className = "",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  id?: string;
  name: string;
  image?: string | null;
  size?: keyof typeof sizes;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (image) {
    return <img {...props} src={image} alt={props.alt ?? name} className={["rounded-full object-cover", sizes[size], className].join(" ")} />;
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={[
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-black text-white",
        gradients[0],
        id ? gradientFor(id) : gradients[0],
        sizes[size],
        className,
      ].join(" ")}
    >
      {initials}
    </span>
  );
}
