import { Chrome } from "@/components/ui/chrome";
import { SiteFooter } from "@/components/ui/site-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Chrome />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
