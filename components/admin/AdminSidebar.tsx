import Link from "next/link";
const links=[["/admin","לוח בקרה"],["/admin/calendar","יומן וזמינות"],["/admin/appointments","תורים"],["/admin/services","שירותים ומחירים"],["/admin/hours","שעות פעילות"],["/admin/gallery","גלריית עבודות"],["/admin/admins","ניהול מנהלים"],["/admin/settings","הגדרות"]];
export default function AdminSidebar(){return <aside className="sidebar"><div className="brand"><b>FAYGEN</b><span>ADMIN</span></div><nav>{links.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav><a href="/">← חזרה לאתר</a></aside>}
