import { Link } from "react-router-dom";
import { ExternalLink, Facebook, Globe, Instagram, Linkedin, Mail, Phone, ShieldCheck, Youtube } from "lucide-react";

const ufhLinks = [
  { label: "First Year Experience", href: "https://fye.ufh.ac.za/" },
  { label: "Student email", href: "https://outlook.cloud.microsoft/mail/?realm=ufh.ac.za" },
  { label: "Staff email", href: "https://outlook.cloud.microsoft/mail/?realm=ufh.ac.za" },
  { label: "Blackboard", href: "https://learn.ufh.ac.za/" },
  { label: "Turnitin", href: "https://www.turnitin.com/" },
  { label: "InfoEd", href: "https://infoed.ufh.ac.za/" },
  { label: "Online services (ITS)", href: "https://ienabler.ufh.ac.za/pls/prodi41/w99pkg.mi_login" },
  { label: "ICT Service Desk", href: "https://smportal.ufh.ac.za/CherwellPortal/IT?_=4a9631cb" },
  { label: "User Account Management", href: "https://passwordreset.microsoftonline.com/passwordreset#!/" },
  { label: "Contact Us", href: "https://www.ufh.ac.za/find-us" },
];

const socialLinks = [
  { label: "X", href: "https://x.com/ufh1916", icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.5 22h-5.6l-4.4-5.7L8.5 22H5.4l7.3-8.3L.5 2h5.7l4 5.2L18.9 2Z" /></svg> },
  { label: "Facebook", href: "https://www.facebook.com/ufh1916", icon: <Facebook className="h-4 w-4" /> },
  { label: "Instagram", href: "https://www.instagram.com/ufh1916", icon: <Instagram className="h-4 w-4" /> },
  { label: "YouTube", href: "https://www.youtube.com/ufh1916", icon: <Youtube className="h-4 w-4" /> },
  { label: "LinkedIn", href: "https://www.linkedin.com/school/university-of-fort-hare", icon: <Linkedin className="h-4 w-4" /> },
];

const legalLinks = [
  { label: "Terms of Use", to: "/terms" },
  { label: "Disclaimer", to: "/disclaimer" },
  { label: "Privacy Policy", to: "/privacy" },
];

export const SiteFooter = () => {
  return (
    <footer className="bg-foreground text-background mt-auto">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr_0.9fr]">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-background/80">
              <ShieldCheck className="h-4 w-4" /> UFH resources
            </div>
            <p className="mt-3 max-w-xl text-sm text-background/70">
              Access the key UFH services, student systems, and support channels from one place.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm text-background/90 transition hover:bg-white/20"
                >
                  {social.icon}
                  <span>{social.label}</span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-background/80">Important UFH links</h3>
            <ul className="mt-4 space-y-2 text-sm text-background/75">
              {ufhLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noreferrer" className="flex items-center gap-2 transition hover:text-background">
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span>{link.label}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-background/80">Contact & policies</h3>
            <ul className="mt-4 space-y-2 text-sm text-background/75">
              <li>
                <a href="mailto:info@ufh.ac.za" className="flex items-center gap-2 transition hover:text-background">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>info@ufh.ac.za</span>
                </a>
              </li>
              <li>
                <a href="tel:+27406022011" className="flex items-center gap-2 transition hover:text-background">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>+27 40 602 2011</span>
                </a>
              </li>
              {legalLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition hover:text-background">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-background/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} University of Fort Hare. All rights reserved.</p>
          <p>UFH Opportunity Hub</p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
