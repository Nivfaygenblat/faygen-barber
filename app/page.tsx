import Image from "next/image";
import Booking from "@/components/Booking";

const services = [
  { name: "תספורת גבר + זקן", text: "30 דקות", price: 60, time: 30 },
  { name: "תספורת + זקן + פלוס שעווה", text: "35 דקות", price: 65, time: 35 },
  { name: "תספורת בלי זקן", text: "30 דקות", price: 50, time: 30 },
  { name: "זקן", text: "10 דקות", price: 20, time: 10 },
  { name: "תספורת שיער ארוך / גזירות", text: "50 דקות", price: 70, time: 50 },
];

const Icon = ({ name }: { name: "instagram" | "whatsapp" | "waze" | "phone" | "location" | "clock" | "scissors" }) => <span className={`icon icon-${name}`} aria-hidden="true" />;

export default function Home() {
  return <main>
    <header className="topbar"><a href="#home" className="brand" aria-label="FAYGEN BARBER דף הבית"><b>FAYGEN</b><span>BARBER</span></a><nav aria-label="ניווט ראשי"><a href="#services">שירותים</a><a href="#about">למה אנחנו</a><a href="#gallery">גלריה</a><a href="#contact">צור קשר</a></nav><a className="button small" href="#services">קבע תור</a></header>

    <section className="hero" id="home"><Image src="/images/hero-barbershop.jpg" alt="מספרת FAYGEN BARBER" fill priority sizes="100vw" className="hero-image" /><div className="hero-overlay" /><div className="hero-content reveal"><div className="hero-logo"><span>FB</span></div><h1>FAYGEN BARBER</h1><h2>Where Style Begins</h2><p>ספרות מדויקת.<br />שירות אישי.<br />סטייל שנשאר איתך.</p><a className="button hero-cta" href="#services">קבע תור</a><div className="social-actions"><a href="https://wa.me/972522083902" aria-label="WhatsApp"><Icon name="whatsapp" /><small>WHATSAPP</small></a><a href="https://www.instagram.com/faygen_barber_shop" aria-label="Instagram"><Icon name="instagram" /><small>INSTAGRAM</small></a><a href="https://waze.com/ul?q=הירקון%2018%20באר%20יעקב" aria-label="Waze"><Icon name="waze" /><small>WAZE</small></a></div></div></section>

    <section className="marquee" aria-label="ערכי המותג"><span>PRECISION</span><i>✦</i><span>CONFIDENCE</span><i>✦</i><span>STYLE</span></section>

    <section className="services-section" id="services"><div className="section-heading reveal"><p>בחר את השירות שלך</p><h2>בחר סוג <em>תספורת</em></h2><Icon name="scissors" /></div><div className="service-list">{services.map(s => <a className="service-card" href="#booking" key={s.name}><span className="service-icon"><Icon name="scissors" /></span><div><h3>{s.name}</h3><p><Icon name="clock" />{s.time} דקות</p></div><strong>₪{s.price}</strong><i>‹</i></a>)}</div></section>

    <section className="about" id="about"><div className="about-visual reveal"><Image src="/images/barbershop-atmosphere.png" alt="כיסא הספר במספרת FAYGEN" fill sizes="(max-width: 850px) 100vw, 50vw" /><div className="logo-plaque"><b>FB</b><span>FAYGEN BARBER</span><small>EST. 2024</small></div></div><div className="about-copy reveal"><p className="eyebrow">לא עוד מספרה</p><h2>למה לבחור ב־<em>FAYGEN BARBER</em></h2><p>משנתיים וחצי של ניסיון, המתמחה בפיידים מדויקים, תספורות מודרניות ועיצוב שיער ארוך.</p><p>כל לקוח מקבל יחס אישי, הקשבה מלאה ותשומת לב לכל פרט, מתוך מטרה להעניק תוצאה מדויקת, נקייה ומותאמת לסגנון האישי שלו.</p><p>עבורו, ספרות היא לא רק מקצוע — אלא דרך ליצור ביטחון, סטייל וחוויית שירות ברמה הגבוהה ביותר.</p><div className="facts"><b><span>◎</span>יחס אישי<small>לכל לקוח</small></b><b><span>◇</span>דיוק בפרטים<small>100%</small></b><b><span>FB</span>שירות פרימיום<small>חומרים ואווירה</small></b></div></div></section>

    <section className="gallery" id="gallery"><div className="section-heading reveal"><p>העבודות שלנו</p><h2>עבודות <em>נבחרות</em></h2></div><div className="gallery-grid"><figure className="gallery-card">
  <img src="/images/mid-fade.jpg" alt="Mid Fade" className="gallery-photo" />
  <figcaption>MID FADE</figcaption>
</figure>

<figure className="gallery-card">
  <img src="/images/low-taper.jpg" alt="Low Taper Fade" className="gallery-photo" />
  <figcaption>LOW TAPER FADE</figcaption>
</figure>

<figure className="gallery-card">
  <img src="/images/classic-fade.jpg" alt="Classic Fade" className="gallery-photo" />
  <figcaption>CLASSIC FADE</figcaption>
</figure>

<figure className="gallery-card">
  <img src="/images/skin-fade.jpg" alt="Skin Fade" className="gallery-photo" />
  <figcaption>SKIN FADE</figcaption>
</figure></div><a className="outline-button" href="https://www.instagram.com/faygen_barber_shop"><Icon name="instagram" />לעוד עבודות באינסטגרם</a></section>

    <Booking services={services} />

    <section className="contact" id="contact"><Image src="/images/barbershop-atmosphere.png" alt="אווירת מספרת FAYGEN" fill sizes="100vw" className="contact-bg" /><div className="contact-overlay" /><div className="contact-content"><p className="eyebrow">בואו לבקר</p><h2>בוא נקבע את<br /><em>התספורת הבאה שלך.</em></h2><p>מחכים לראות אותך ב־FAYGEN BARBER.</p><div className="contact-cards"><article><Icon name="location" /><div><small>כתובת</small><b>הירקון 18<br />באר יעקב</b></div></article><article><Icon name="phone" /><div><small>טלפון</small><a href="tel:0522083902">052-208-3902</a></div></article><article><Icon name="clock" /><div><small>שעות פעילות</small><b>א׳–ה׳ 09:00–20:00<br />ו׳ 09:00–14:00</b></div></article></div><div className="contact-buttons"><a href="https://waze.com/ul?q=הירקון%2018%20באר%20יעקב"><Icon name="waze" />WAZE</a><a href="tel:0522083902"><Icon name="phone" />התקשר עכשיו</a><a href="https://www.instagram.com/faygen_barber_shop"><Icon name="instagram" />INSTAGRAM</a></div><div className="rating"><b>★★★★★</b><span>מאות לקוחות מרוצים חוזרים שוב ושוב.</span></div></div></section>

    <footer><div className="footer-logo"><b>FB</b><span>FAYGEN BARBER</span><em>Where Style Begins</em></div><div className="footer-links"><a href="https://www.instagram.com/faygen_barber_shop">Instagram</a><a href="https://wa.me/972522083902">WhatsApp</a><a href="/admin/login">כניסת מנהל</a></div><small>© 2026 FAYGEN BARBER. כל הזכויות שמורות.</small></footer>
    <a className="whatsapp" href="https://wa.me/972522083902" aria-label="פתיחת WhatsApp"><Icon name="whatsapp" /></a>
  </main>
}
