import { ShowcaseLayout } from "@/components/showcase-layout";

export default function ChartsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShowcaseLayout>{children}</ShowcaseLayout>;
}
