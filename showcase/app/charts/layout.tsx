import { Suspense } from "react";
import { ShowcaseLayout } from "@/components/showcase-layout";

export default function ChartsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ChartDetailPage reads the search params, which needs a boundary in a statically built route.
  return (
    <ShowcaseLayout>
      <Suspense>{children}</Suspense>
    </ShowcaseLayout>
  );
}
