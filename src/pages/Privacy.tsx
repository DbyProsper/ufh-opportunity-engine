import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Lock } from "lucide-react";

const Privacy = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <AppHeader />
    <main className="container mx-auto flex-1 px-4 py-10 md:py-14">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card/70 p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">University of Fort Hare</p>
          </div>
        </div>

        <div className="space-y-4 text-sm leading-7 text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">Who we are</h2>
          <p>The University of Fort Hare (UFH) is a juristic person and is deemed a university by, and operates in terms of, the Higher Education Act 101 of 1997, as amended. The University is also governed by its Institutional Statute and Institutional Rules. The primary functions of the University are teaching, learning, and research.</p>
          <p>The Information Officer of the University is the Vice-Chancellor and can be contacted at <a href="mailto:paia@ufh.ac.za" className="text-primary underline">paia@ufh.ac.za</a>.</p>
          <h2 className="text-base font-semibold text-foreground">Cookies</h2>
          <p>If you fill in a form on our site you may opt-in to saving your name, email address and website in cookies. These are for your convenience so that you do not have to fill in your details again when you leave another comment. These cookies will last for one year.</p>
          <h2 className="text-base font-semibold text-foreground">Embedded content from other websites</h2>
          <p>Articles on this site may include embedded content (e.g. videos, images, articles, etc.). Embedded content from other websites behaves in the exact same way as if the visitor has visited the other website. These websites may collect data about you, use cookies, embed additional third-party tracking, and monitor your interaction with that embedded content, including tracking your interaction with the embedded content if you have an account and are logged in to that website.</p>
          <h2 className="text-base font-semibold text-foreground">How long we retain your data</h2>
          <p>When you complete a form, the information you provide, along with any associated metadata, is retained for as long as necessary to fulfil the purpose for which it was collected or as required by applicable legal and regulatory obligations.</p>
          <h2 className="text-base font-semibold text-foreground">What rights you have over your data</h2>
          <p>If you have filled in a form on this site, you can request to receive an exported file of the personal data we hold about you, including any data you have provided to us. You can also request that we erase any personal data we hold about you. This does not include any data we are obliged to keep for administrative, legal, or security purposes.</p>
          <h2 className="text-base font-semibold text-foreground">Where your data is sent</h2>
          <p>Forms filled in are emailed to relevant members of staff of the University of Fort Hare.</p>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default Privacy;
