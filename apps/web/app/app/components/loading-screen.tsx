import Image from "next/image";
import { appConfig } from "@/app/config";

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Image
        src={appConfig.icons.md.src}
        alt={appConfig.name}
        width={128}
        height={128}
        priority
        className="h-32 w-32"
      />
    </div>
  );
}
