"use client";

import Image from "next/image";
import { appConfig } from "@/app/config";
import { Github } from "lucide-react";

export function Footer() {
  const { creator } = appConfig;
  return (
    <footer className="border-t border-border/50 bg-muted/10 px-6 py-12 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
          <Image
            src="/icon-192x192.png"
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-xl"
          />
          <span className="text-xs text-muted-foreground">
            Built by{" "}
            <a
              href={creator.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {creator.name}
            </a>
            . Splitting bills shouldn&apos;t cost you.
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          {appConfig.githubUrl ? (
            <a
              href={appConfig.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Github className="h-4 w-4" />
              Star on GitHub
            </a>
          ) : null}
          <a
            href={creator.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          {creator.otherProjects.map((project) => (
            <a
              key={project.url}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {project.name}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
