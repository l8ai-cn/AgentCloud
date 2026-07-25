import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Market | AI Partners",
  description:
    "Discover AI partners built for real work. Inspect capabilities, evidence, and permissions before enabling one.",
  alternates: {
    canonical: "https://agentcloud.ai/marketplace",
  },
  openGraph: {
    title: "Agent Market | AI Partners | Agent Cloud",
    description:
      "Discover AI partners built for real work and inspect their capabilities before enabling one.",
    url: "https://agentcloud.ai/marketplace",
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
