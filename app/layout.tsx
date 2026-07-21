import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "FAYGEN BARBER | מספרת גברים בבאר יעקב",
  description: "FAYGEN BARBER – מספרת גברים בבאר יעקב. תספורות גברים, ילדים, פייד ועיצוב זקן. קביעת תור אונליין.",
  keywords: ["מספרה באר יעקב","ספר גברים באר יעקב","תספורת גברים","תספורת ילדים","פייד","עיצוב זקן"],
  openGraph: { title: "FAYGEN BARBER", description: "Where Style Begins. מספרת גברים בבאר יעקב", type: "website", locale: "he_IL" },
  robots: { index: true, follow: true },
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  const schema={"@context":"https://schema.org","@type":"HairSalon",name:"FAYGEN BARBER",telephone:"052-208-3902",address:{"@type":"PostalAddress",streetAddress:"הירקון 18",addressLocality:"באר יעקב",addressCountry:"IL"},sameAs:["https://www.instagram.com/faygen_barber_shop"]};
  return <html lang="he" dir="rtl"><body>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></body></html>;
}
