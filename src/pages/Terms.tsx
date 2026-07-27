import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ShieldCheck } from "lucide-react";

const Terms = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <AppHeader />
    <main className="container mx-auto flex-1 px-4 py-10 md:py-14">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card/70 p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Terms of Use</h1>
            <p className="text-sm text-muted-foreground">University of Fort Hare</p>
          </div>
        </div>

        <div className="space-y-4 text-sm leading-7 text-muted-foreground">
          <p>Welcome to the University of Fort Hare&apos;s website. By accessing and using this site, you agree to comply with the following Terms of Use. If you do not agree, please discontinue use of the website.</p>
          <h2 className="text-base font-semibold text-foreground">Acceptance of Terms</h2>
          <p>By accessing and using this website, you accept and agree to be bound by these Terms of Use and all applicable laws and regulations, including the Protection of Personal Information Act, 2013 (POPIA), and the Electronic Communications and Transactions Act, 2002 (ECTA).</p>
          <h2 className="text-base font-semibold text-foreground">User Conduct</h2>
          <p>As a user, you agree not to use the site for unlawful purposes, not to upload or transmit harmful or malicious content, and to respect the rights of other users and not infringe on their privacy.</p>
          <h2 className="text-base font-semibold text-foreground">Intellectual Property</h2>
          <p>All content, including text, graphics, logos, and software, is the property of the University of Fort Hare and/or its licensors and is protected under South African copyright laws. Unauthorised use is prohibited.</p>
          <h2 className="text-base font-semibold text-foreground">Privacy Policy</h2>
          <p>Your privacy is important to us. Our Privacy Policy, in compliance with POPIA, outlines how we collect, use, and protect your information. By using our site, you consent to such processes.</p>
          <h2 className="text-base font-semibold text-foreground">Limitation of Liability</h2>
          <p>The University of Fort Hare will not be liable for any damages arising from the use or inability to use the site. This includes, but is not limited to, direct, indirect, incidental, punitive, and consequential damages.</p>
          <h2 className="text-base font-semibold text-foreground">External Links</h2>
          <p>This website may contain links to external sites not controlled by the University of Fort Hare. We are not responsible for the content or practices of any linked sites. Access is at your own risk.</p>
          <h2 className="text-base font-semibold text-foreground">Changes to Terms</h2>
          <p>The University of Fort Hare reserves the right to modify these Terms of Use at any time. Continued use of the site following any changes indicates your acceptance of the new terms.</p>
          <h2 className="text-base font-semibold text-foreground">Governing Law</h2>
          <p>These terms are governed by the laws of the Republic of South Africa. Any disputes arising from these terms shall be settled in the courts of South Africa.</p>
          <h2 className="text-base font-semibold text-foreground">Contact Information</h2>
          <p>For any questions or concerns about these Terms of Use, please contact us at <a href="mailto:info@ufh.ac.za" className="text-primary underline">info@ufh.ac.za</a>.</p>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default Terms;
