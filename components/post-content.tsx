"use client";

import Link from "next/link";

const HASH_TAG_PATTERN = /#[A-Za-z0-9_]{2,40}/g;

export function PostContent({ content, className = "" }: { content: string; className?: string }) {
  const parts = content.split(HASH_TAG_PATTERN);
  const matches = content.match(HASH_TAG_PATTERN) ?? [];
  let matchIndex = 0;

  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (index === 0) return part;
        const tag = matches[matchIndex++] ?? "";
        return (
          <span key={index}>
            <Link href={"/discover?q=" + encodeURIComponent(tag)} className="font-semibold text-[#5a4be8] hover:underline">
              {tag}
            </Link>
            {part}
          </span>
        );
      })}
    </p>
  );
}
