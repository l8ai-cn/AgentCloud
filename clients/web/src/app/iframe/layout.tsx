import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function IframeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh min-h-0 w-full overflow-hidden bg-background">
      {children}
    </div>
  );
}
