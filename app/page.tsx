import Image from "next/image";
import Booking from "@/components/Booking";

type Service = {
  name: string;
  text: string;
  price: number;
  time: number;
};

type ApiService = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  duration_minutes: number;
  buffer_minutes: number;
  is_bookable: boolean;
  sort_order: number;
};

type GalleryItem = {
  id: string;
  slot_key: string;
  title: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
};

type ContentPayload = Record<string, unknown>;

type ContentSection = {
  title: string | null;
  body: string | null;
  payload: ContentPayload;
};

type WebsiteContent = Record<string, ContentSection>;

const fallbackGalleryItems: GalleryItem[] = [
  {
    id: "gallery-1",
    slot_key: "gallery_1",
    title: "MID FADE",
    image_url: "/images/mid-fade.jpg",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "gallery-2",
    slot_key: "gallery_2",
    title: "LOW TAPER FADE",
    image_url: "/images/low-taper.jpg",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "gallery-3",
    slot_key: "gallery_3",
    title: "CLASSIC FADE",
    image_url: "/images/classic-fade.jpg",
    sort_order: 3,
    is_active: true,
  },
  {
    id: "gallery-4",
    slot_key: "gallery_4",
    title: "SKIN FADE",
    image_url: "/images/skin-fade.jpg",
    sort_order: 4,
    is_active: true,
  },
];

const fallbackServices: Service[] = [
  {
    name: "תספורת גבר + זקן",
    text: "30 דקות",
    price: 60,
    time: 30,
  },
  {
    name: "תספורת + זקן + פלוס שעווה",
    text: "35 דקות",
    price: 65,
    time: 35,
  },
  {
    name: "תספורת בלי זקן",
    text: "30 דקות",
    price: 50,
    time: 30,
  },
  {
    name: "זקן",
    text: "10 דקות",
    price: 20,
    time: 10,
  },
  {
    name: "תספורת שיער ארוך / גזירות",
    text: "50 דקות",
    price: 70,
    time: 50,
  },
];

const fallbackContent: WebsiteContent = {
  hero: {
    title: "FAYGEN BARBER",
    body: "ספרות מדויקת.\nשירות אישי.\nסטייל שנשאר איתך.",
    payload: {
      subtitle: "Where Style Begins",
      button_text: "קבע תור",
    },
  },

  services: {
    title: "בחר סוג תספורת",
    body: null,
    payload: {
      eyebrow: "בחר את השירות שלך",
    },
  },

  about: {
    title: "למה לבחור ב־FAYGEN BARBER",
    body:
      "משנתיים וחצי של ניסיון, המתמחה בפיידים מדויקים, תספורות מודרניות ועיצוב שיער ארוך.\n\nכל לקוח מקבל יחס אישי, הקשבה מלאה ותשומת לב לכל פרט, מתוך מטרה להעניק תוצאה מדויקת, נקייה ומותאמת לסגנון האישי שלו.\n\nעבורו, ספרות היא לא רק מקצוע — אלא דרך ליצור ביטחון, סטייל וחוויית שירות ברמה הגבוהה ביותר.",
    payload: {
      eyebrow: "לא עוד מספרה",
    },
  },

  gallery: {
    title: "עבודות נבחרות",
    body: null,
    payload: {
      eyebrow: "העבודות שלנו",
      instagram_url:
        "https://www.instagram.com/faygen_barber_shop",
    },
  },

  contact: {
    title: "בוא נקבע את התספורת הבאה שלך.",
    body: "מחכים לראות אותך ב־FAYGEN BARBER.",
    payload: {
      eyebrow: "בואו לבקר",
      phone: "052-208-3902",
      address: "הירקון 18\nבאר יעקב",
      hours: "א׳–ה׳ 09:00–20:00\nו׳ 09:00–14:00",
      instagram_url:
        "https://www.instagram.com/faygen_barber_shop",
      whatsapp_url: "https://wa.me/972522083902",
      waze_url:
        "https://waze.com/ul?q=הירקון%2018%20באר%20יעקב",
    },
  },

  footer: {
    title: "FAYGEN BARBER",
    body: "Where Style Begins",
    payload: {
      instagram_url:
        "https://www.instagram.com/faygen_barber_shop",
      whatsapp_url: "https://wa.me/972522083902",
      copyright_text:
        "© 2026 FAYGEN BARBER. כל הזכויות שמורות.",
    },
  },
};

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

async function getServices(): Promise<Service[]> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/api/public/services`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("לא ניתן לטעון את השירותים");
    }

    const data: { services?: ApiService[] } =
      await response.json();

    const services = (data.services || []).map((service) => ({
      name: service.name,
      text: `${service.duration_minutes} דקות`,
      price: Number(service.price),
      time: service.duration_minutes,
    }));

    return services.length > 0
      ? services
      : fallbackServices;
  } catch (error) {
    console.error("Home services error:", error);
    return fallbackServices;
  }
}

async function getGalleryItems(): Promise<GalleryItem[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Home gallery error: missing Supabase server environment variables"
    );
    return fallbackGalleryItems;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/gallery_items?select=id,slot_key,title,image_url,sort_order,is_active&is_active=eq.true&order=sort_order.asc`,
      {
        cache: "no-store",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("לא ניתן לטעון את הגלריה");
    }

    const galleryItems: GalleryItem[] = await response.json();

    return galleryItems.length > 0
      ? galleryItems
      : fallbackGalleryItems;
  } catch (error) {
    console.error("Home gallery error:", error);
    return fallbackGalleryItems;
  }
}

async function getWebsiteContent(): Promise<WebsiteContent> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/api/public/content`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("לא ניתן לטעון את תוכן האתר");
    }

    const data: {
      content?: WebsiteContent;
    } = await response.json();

    const databaseContent = data.content || {};

    return {
      ...fallbackContent,
      ...databaseContent,
    };
  } catch (error) {
    console.error("Home content error:", error);
    return fallbackContent;
  }
}

function getPayloadText(
  section: ContentSection | undefined,
  key: string,
  fallback = ""
): string {
  const value = section?.payload?.[key];

  if (
    typeof value === "string" &&
    value.trim().length > 0
  ) {
    return value.trim();
  }

  return fallback;
}

function getTitle(
  section: ContentSection | undefined,
  fallback: string
): string {
  if (
    typeof section?.title === "string" &&
    section.title.trim().length > 0
  ) {
    return section.title.trim();
  }

  return fallback;
}

function getBody(
  section: ContentSection | undefined,
  fallback: string
): string {
  if (
    typeof section?.body === "string" &&
    section.body.trim().length > 0
  ) {
    return section.body.trim();
  }

  return fallback;
}

function TextWithBreaks({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

function Paragraphs({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph}-${index}`}>
          <TextWithBreaks text={paragraph} />
        </p>
      ))}
    </>
  );
}

function phoneHref(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, "");

  return normalized ? `tel:${normalized}` : "#contact";
}

const Icon = ({
  name,
}: {
  name:
    | "instagram"
    | "whatsapp"
    | "waze"
    | "phone"
    | "location"
    | "clock"
    | "scissors";
}) => (
  <span
    className={`icon icon-${name}`}
    aria-hidden="true"
  />
);

export default async function Home() {
  const [services, content, galleryItems] = await Promise.all([
    getServices(),
    getWebsiteContent(),
    getGalleryItems(),
  ]);

  const hero = content.hero || fallbackContent.hero;
  const servicesContent =
    content.services || fallbackContent.services;
  const about = content.about || fallbackContent.about;
  const gallery =
    content.gallery || fallbackContent.gallery;
  const contact =
    content.contact || fallbackContent.contact;
  const footer = content.footer || fallbackContent.footer;

  const heroTitle = getTitle(hero, "FAYGEN BARBER");
  const heroSubtitle = getPayloadText(
    hero,
    "subtitle",
    "Where Style Begins"
  );
  const heroBody = getBody(
    hero,
    "ספרות מדויקת.\nשירות אישי.\nסטייל שנשאר איתך."
  );
  const heroButton = getPayloadText(
    hero,
    "button_text",
    "קבע תור"
  );

  const servicesTitle = getTitle(
    servicesContent,
    "בחר סוג תספורת"
  );
  const servicesEyebrow = getPayloadText(
    servicesContent,
    "eyebrow",
    "בחר את השירות שלך"
  );

  const aboutTitle = getTitle(
    about,
    "למה לבחור ב־FAYGEN BARBER"
  );
  const aboutEyebrow = getPayloadText(
    about,
    "eyebrow",
    "לא עוד מספרה"
  );
  const aboutBody = getBody(
    about,
    fallbackContent.about.body || ""
  );

  const galleryTitle = getTitle(
    gallery,
    "עבודות נבחרות"
  );
  const galleryEyebrow = getPayloadText(
    gallery,
    "eyebrow",
    "העבודות שלנו"
  );
  const galleryInstagram = getPayloadText(
    gallery,
    "instagram_url",
    "https://www.instagram.com/faygen_barber_shop"
  );

  const contactTitle = getTitle(
    contact,
    "בוא נקבע את התספורת הבאה שלך."
  );
  const contactBody = getBody(
    contact,
    "מחכים לראות אותך ב־FAYGEN BARBER."
  );
  const contactEyebrow = getPayloadText(
    contact,
    "eyebrow",
    "בואו לבקר"
  );
  const phone = getPayloadText(
    contact,
    "phone",
    "052-208-3902"
  );
  const address = getPayloadText(
    contact,
    "address",
    "הירקון 18\nבאר יעקב"
  );
  const hours = getPayloadText(
    contact,
    "hours",
    "א׳–ה׳ 09:00–20:00\nו׳ 09:00–14:00"
  );
  const instagramUrl = getPayloadText(
    contact,
    "instagram_url",
    galleryInstagram
  );
  const whatsappUrl = getPayloadText(
    contact,
    "whatsapp_url",
    "https://wa.me/972522083902"
  );
  const wazeUrl = getPayloadText(
    contact,
    "waze_url",
    "https://waze.com/ul?q=הירקון%2018%20באר%20יעקב"
  );

  const footerTitle = getTitle(
    footer,
    "FAYGEN BARBER"
  );
  const footerBody = getBody(
    footer,
    "Where Style Begins"
  );
  const footerInstagram = getPayloadText(
    footer,
    "instagram_url",
    instagramUrl
  );
  const footerWhatsapp = getPayloadText(
    footer,
    "whatsapp_url",
    whatsappUrl
  );
  const copyrightText = getPayloadText(
    footer,
    "copyright_text",
    "© 2026 FAYGEN BARBER. כל הזכויות שמורות."
  );

  return (
    <main>
      <header className="topbar">
        <a
          href="#home"
          className="brand"
          aria-label={`${heroTitle} דף הבית`}
        >
          <b>FAYGEN</b>
          <span>BARBER</span>
        </a>

        <nav aria-label="ניווט ראשי">
          <a href="#services">שירותים</a>
          <a href="#about">למה אנחנו</a>
          <a href="#gallery">גלריה</a>
          <a href="#contact">צור קשר</a>
        </nav>

        <a className="button small" href="#services">
          {heroButton}
        </a>
      </header>

      <section className="hero" id="home">
        <Image
          src="/images/hero-barbershop.jpg"
          alt={`מספרת ${heroTitle}`}
          fill
          priority
          sizes="100vw"
          className="hero-image"
        />

        <div className="hero-overlay" />

        <div className="hero-content reveal">
          <div className="hero-logo">
            <span>FB</span>
          </div>

          <h1>{heroTitle}</h1>
          <h2>{heroSubtitle}</h2>

          <p>
            <TextWithBreaks text={heroBody} />
          </p>

          <a
            className="button hero-cta"
            href="#services"
          >
            {heroButton}
          </a>

          <div className="social-actions">
            <a
              href={whatsappUrl}
              aria-label="WhatsApp"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="whatsapp" />
              <small>WHATSAPP</small>
            </a>

            <a
              href={instagramUrl}
              aria-label="Instagram"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="instagram" />
              <small>INSTAGRAM</small>
            </a>

            <a
              href={wazeUrl}
              aria-label="Waze"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="waze" />
              <small>WAZE</small>
            </a>
          </div>
        </div>
      </section>

      <section
        className="marquee"
        aria-label="ערכי המותג"
      >
        <span>PRECISION</span>
        <i>✦</i>
        <span>CONFIDENCE</span>
        <i>✦</i>
        <span>STYLE</span>
      </section>

      <section
        className="services-section"
        id="services"
      >
        <div className="section-heading reveal">
          <p>{servicesEyebrow}</p>

          <h2>{servicesTitle}</h2>

          <Icon name="scissors" />
        </div>

        <div className="service-list">
          {services.map((service) => (
            <a
              className="service-card"
              href="#booking"
              key={service.name}
            >
              <span className="service-icon">
                <Icon name="scissors" />
              </span>

              <div>
                <h3>{service.name}</h3>

                <p>
                  <Icon name="clock" />
                  {service.time} דקות
                </p>
              </div>

              <strong>₪{service.price}</strong>
              <i>‹</i>
            </a>
          ))}
        </div>
      </section>

      <section className="about" id="about">
        <div className="about-visual reveal">
          <Image
            src="/images/barbershop-atmosphere.png"
            alt={`כיסא הספר במספרת ${heroTitle}`}
            fill
            sizes="(max-width: 850px) 100vw, 50vw"
          />

          <div className="logo-plaque">
            <b>FB</b>
            <span>FAYGEN BARBER</span>
            <small>EST. 2024</small>
          </div>
        </div>

        <div className="about-copy reveal">
          <p className="eyebrow">{aboutEyebrow}</p>

          <h2>{aboutTitle}</h2>

          <Paragraphs text={aboutBody} />

          <div className="facts">
            <b>
              <span>◎</span>
              יחס אישי
              <small>לכל לקוח</small>
            </b>

            <b>
              <span>◇</span>
              דיוק בפרטים
              <small>100%</small>
            </b>

            <b>
              <span>FB</span>
              שירות פרימיום
              <small>חומרים ואווירה</small>
            </b>
          </div>
        </div>
      </section>

      <section className="gallery" id="gallery">
        <div className="section-heading reveal">
          <p>{galleryEyebrow}</p>

          <h2>{galleryTitle}</h2>
        </div>

        <div className="gallery-grid">
          {galleryItems.map((item) => (
            <figure className="gallery-card" key={item.id}>
              <img
                src={item.image_url}
                alt={item.title}
                className="gallery-photo"
              />
              <figcaption>{item.title}</figcaption>
            </figure>
          ))}
        </div>

        <a
          className="outline-button"
          href={galleryInstagram}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="instagram" />
          לעוד עבודות באינסטגרם
        </a>
      </section>

      <Booking services={services} />

      <section className="contact" id="contact">
        <Image
          src="/images/barbershop-atmosphere.png"
          alt={`אווירת מספרת ${heroTitle}`}
          fill
          sizes="100vw"
          className="contact-bg"
        />

        <div className="contact-overlay" />

        <div className="contact-content">
          <p className="eyebrow">
            {contactEyebrow}
          </p>

          <h2>{contactTitle}</h2>

          <p>{contactBody}</p>

          <div className="contact-cards">
            <article>
              <Icon name="location" />

              <div>
                <small>כתובת</small>
                <b>
                  <TextWithBreaks text={address} />
                </b>
              </div>
            </article>

            <article>
              <Icon name="phone" />

              <div>
                <small>טלפון</small>
                <a href={phoneHref(phone)}>
                  {phone}
                </a>
              </div>
            </article>

            <article>
              <Icon name="clock" />

              <div>
                <small>שעות פעילות</small>
                <b>
                  <TextWithBreaks text={hours} />
                </b>
              </div>
            </article>
          </div>

          <div className="contact-buttons">
            <a
              href={wazeUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="waze" />
              WAZE
            </a>

            <a href={phoneHref(phone)}>
              <Icon name="phone" />
              התקשר עכשיו
            </a>

            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="instagram" />
              INSTAGRAM
            </a>
          </div>

          <div className="rating">
            <b>★★★★★</b>
            <span>
              מאות לקוחות מרוצים חוזרים שוב ושוב.
            </span>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-logo">
          <b>FB</b>
          <span>{footerTitle}</span>
          <em>{footerBody}</em>
        </div>

        <div className="footer-links">
          <a
            href={footerInstagram}
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>

          <a
            href={footerWhatsapp}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>

          <a href="/admin/login">
            כניסת מנהל
          </a>
        </div>

        <small>{copyrightText}</small>
      </footer>

      <a
        className="whatsapp"
        href={whatsappUrl}
        aria-label="פתיחת WhatsApp"
        target="_blank"
        rel="noreferrer"
      >
        <Icon name="whatsapp" />
      </a>
    </main>
  );
}