import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AlertTriangle } from "lucide-react";

const Disclaimer = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <AppHeader />
    <main className="container mx-auto flex-1 px-4 py-10 md:py-14">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card/70 p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Disclaimer</h1>
            <p className="text-sm text-muted-foreground">University of Fort Hare</p>
          </div>
        </div>

        <div className="space-y-4 text-sm leading-7 text-muted-foreground">
          <p>The information provided on the University of Fort Hare (UFH) website (www.ufh.ac.za) is for general informational purposes only. While every effort is made to ensure that the content is accurate, complete, and up-to-date, UFH does not guarantee or warrant the accuracy, reliability, or completeness of any information on this site.</p>
          <p>Visitors to this website use the information at their own risk. UFH will not be held liable for any loss, damage, or inconvenience arising from the use of this website or reliance on any information provided, whether direct, indirect, incidental, or consequential.</p>
          <p>Links to external websites are provided for convenience and informational purposes only. UFH has no control over the content or availability of these sites and does not endorse or accept any responsibility for their content, policies, or practices.</p>
          <p>UFH reserves the right to update, modify, or remove content on this website without prior notice. Users are encouraged to verify the information and consult appropriate professionals or departments at UFH for specific advice or guidance.</p>
          <p>By accessing this website, you agree to the terms of this disclaimer and acknowledge that it is subject to South African law.</p>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default Disclaimer;
