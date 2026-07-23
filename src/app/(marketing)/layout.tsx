import { MegaNavServer } from '@/components/layout/MegaNavServer';
import { Footer } from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MegaNavServer />
      <main>{children}</main>
      <Footer />
      <ScrollReveal />
    </>
  );
}
