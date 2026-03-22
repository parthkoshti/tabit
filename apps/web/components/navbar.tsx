"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/app/config";
import { Github, Menu, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "Blog", href: "/blog" },
  { label: "Motivation", href: "/blog/why-tab" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-border/30 bg-background/70 px-5 shadow-sm backdrop-blur-sm supports-backdrop-filter:bg-background/50">
          <TransitionLink
            href="/"
            className="flex items-center text-foreground transition-opacity hover:opacity-80"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/icon-192x192.png"
              alt={appConfig.name}
              width={44}
              height={44}
              className="size-11 rounded-xl"
            />
          </TransitionLink>

          {/* Desktop nav */}
          <div className="flex items-center gap-1">
            <div className="hidden sm:flex items-center mr-2">
              {navLinks.map((link) => (
                <TransitionLink
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </TransitionLink>
              ))}
              {appConfig.githubUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Link
                    href={appConfig.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <Github className="h-4 w-4" />
                    Star
                  </Link>
                </Button>
              ) : null}
            </div>
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href={`${appConfig.pwaUrl}`}>Get started</Link>
            </Button>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/50"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-0 top-18 z-40 mx-4 sm:hidden"
          >
            <div className="overflow-hidden rounded-2xl border border-border/30 bg-background/95 shadow-lg backdrop-blur-sm">
              <nav className="flex flex-col p-3">
                {navLinks.map((link) => (
                  <TransitionLink
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    {link.label}
                  </TransitionLink>
                ))}
                {appConfig.githubUrl ? (
                  <Link
                    href={appConfig.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <Github className="h-4 w-4" />
                    Star on GitHub
                  </Link>
                ) : null}
              </nav>
              <div className="border-t border-border/30 p-3">
                <Button asChild className="w-full gap-2">
                  <Link href={`${appConfig.pwaUrl}`} onClick={() => setOpen(false)}>
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-30 sm:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
