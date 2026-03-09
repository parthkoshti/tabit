"use client";

import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function UserAvatar({
  userId,
  className,
  size = "default",
}: {
  userId: string;
  className?: string;
  size?: "xs" | "sm" | "default" | "lg" | "xl";
}) {
  const dataUrl = useMemo(() => {
    const avatar = createAvatar(thumbs, {
      seed: userId,
      backgroundType: ["gradientLinear"],
      scale: 80,
      backgroundColor: ["919bff", "133a94"],
      shapeColor: ["ffbe0b", "fb5607", "ff006e", "8338ec", "3a86ff"],
      flip:
        userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 2 === 0,
    });
    const svg = avatar.toString();
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }, [userId]);

  const sizeClasses = {
    xs: "h-5 w-5",
    sm: "h-6 w-6",
    default: "h-8 w-8",
    lg: "h-10 w-10",
    xl: "h-12 w-12",
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={dataUrl} alt="" />
      <AvatarFallback className="text-xs">?</AvatarFallback>
    </Avatar>
  );
}
