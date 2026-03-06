import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getGroupsForUser } from "@/lib/data";
import Link from "next/link";
import { CreateGroupForm } from "./create-group-form";
import { SignOutButton } from "./sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function GroupsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }

  const groups = await getGroupsForUser(session.user.id);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tabit</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your groups</CardTitle>
            <CardDescription>Create a group or select one to view</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CreateGroupForm />
            {groups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                No groups yet. Create one above.
              </p>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <Link key={g.id} href={`/groups/${g.id}`}>
                    <Card className="transition-colors hover:bg-accent">
                      <CardContent className="flex items-center p-4">
                        <span className="font-medium">{g.name}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
