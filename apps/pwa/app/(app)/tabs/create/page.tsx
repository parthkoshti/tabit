"use client";

import { useEffect } from "react";
import { useNavTitle } from "../../context/nav-title-context";
import { CreateTabForm } from "../create-tab-form";

export default function CreateTabPage() {
  const setNavTitle = useNavTitle();

  useEffect(() => {
    setNavTitle?.({ title: "New tab", backHref: "/tabs" });
    return () => setNavTitle?.(null);
  }, [setNavTitle]);

  return (
    <div className="p-4">
      <div className="mx-auto max-w-md">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Create a tab</h2>
            <p className="text-sm text-muted-foreground">
              Give your tab a name to get started
            </p>
          </div>
          <CreateTabForm />
        </section>
      </div>
    </div>
  );
}
