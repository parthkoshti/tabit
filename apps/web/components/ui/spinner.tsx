import { cn } from "@/lib/utils";

function Spinner({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const sizeClasses = {
    sm: "h-6 w-6 border-2",
    default: "h-8 w-8 border-2",
    lg: "h-10 w-10 border-2",
  };
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-spin rounded-full border-primary border-t-transparent",
        sizeClasses[size],
        className
      )}
    />
  );
}

export { Spinner };
