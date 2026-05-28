import { MegaNavServer } from '@/components/layout/MegaNavServer';
import { Footer } from '@/components/layout/Footer';

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
    </>
  );
}
