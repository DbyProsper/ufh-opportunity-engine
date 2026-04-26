import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  FileCheck,
  ChevronRight,
  CheckCircle2,
  Clock,
  Shield,
  GraduationCap,
  Sparkles,
  Award,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { Typewriter } from "@/components/Typewriter";

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />

      {/* Hero */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 bg-hero-gradient overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm mb-6 animate-fade-in">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              All UFH opportunities, one hub
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight animate-fade-in min-h-[3.5em] md:min-h-[2.4em]">
              <Typewriter
                text="Discover & Apply for Academic Opportunities"
                speed={35}
                startDelay={300}
              />
            </h1>
            <p className="text-base md:text-xl text-white/80 mb-8 max-w-2xl mx-auto animate-fade-in min-h-[3.5em]">
              <Typewriter
                text="Tutorships, bursaries, leadership roles and more. One profile, smart auto-fill, and a clear path from application to offer."
                speed={18}
                startDelay={1800}
              />
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in">
              <Link to={user ? "/dashboard" : "/auth?mode=signup"}>
                <Button
                  size="lg"
                  className="btn-gradient-accent text-accent-foreground font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] px-8 w-full sm:w-auto"
                >
                  {user ? "Browse Opportunities" : "Create Free Account"}
                  <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <button
                onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors h-11 rounded-md px-8 border border-white/30 text-white hover:bg-white/10"
              >
                How it works
              </button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Features */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Built for the modern UFH student
            </h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              One profile, every opportunity. Smart eligibility, auto-saving forms, real-time updates.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { Icon: GraduationCap, title: "Smart Eligibility", text: "Instantly see which opportunities you qualify for based on your faculty, department and role." },
              { Icon: Users, title: "One Profile, All Apps", text: "Update your details once. Every application form auto-fills from your profile." },
              { Icon: Award, title: "Track Everything", text: "Real-time status updates, document checklists and offer letters in one place." },
            ].map(({ Icon, title, text }) => (
              <Card key={title} className="group border-0 shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
                <CardContent className="p-7">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary group-hover:scale-110 transition-all">
                    <Icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 md:py-20 bg-muted/40 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">How it works</h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              From signup to offer letter in three simple steps.
            </p>
          </div>
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            {[
              { n: 1, t: "Build your profile", d: "Sign up and complete your academic profile once." },
              { n: 2, t: "Browse & apply", d: "See eligible opportunities. Forms auto-fill from your profile." },
              { n: 3, t: "Track & accept", d: "Get notified the moment your status changes or an offer arrives." },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-14 h-14 rounded-full btn-gradient-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg">
                  {s.n}
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-1">{s.t}</h3>
                <p className="text-muted-foreground text-sm">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-12 bg-background border-y">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 md:gap-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-success" /> Secure & private</div>
            <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Auto-save drafts</div>
            <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-secondary" /> Role-based access</div>
            <div className="flex items-center gap-2"><FileCheck className="w-5 h-5 text-accent" /> Document tracking</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-hero-gradient">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Ready to get started?</h2>
          <p className="text-white/80 text-base md:text-lg mb-7 max-w-xl mx-auto">
            Join the UFH community of opportunity seekers.
          </p>
          <Link to={user ? "/dashboard" : "/auth?mode=signup"}>
            <Button size="lg" className="btn-gradient-accent text-accent-foreground font-semibold shadow-lg hover:shadow-xl px-10">
              {user ? "Go to Dashboard" : "Create Free Account"}
              <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-foreground text-background mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm opacity-80">© {new Date().getFullYear()} University of Fort Hare. All rights reserved.</p>
            <p className="text-xs opacity-60">UFH Opportunity Hub</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
