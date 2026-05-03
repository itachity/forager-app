import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ForagerLogo } from "@/components/forager/ForagerLogo";
import { Button } from "@/components/ui/button";

export default function ChatRedirectPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md w-full forager-card p-8 text-center">
        <div className="flex justify-center mb-4">
          <ForagerLogo size="lg" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          The chat experience moved
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Conversational search now lives on the home screen, with filters and the
          two scan flows alongside it.
        </p>
        <Button asChild variant="cta" size="xl" className="mt-6 w-full">
          <Link href="/home">
            Go to home <ArrowRight />
          </Link>
        </Button>
      </div>
    </main>
  );
}
