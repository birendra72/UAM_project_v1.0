import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

export default function Pricing() {
  const features = [
    "Unlimited projects",
    "Unlimited datasets",
    "Smart analysis templates",
    "Machine learning models",
    "Data repository",
    "Professional reports",
    "API access",
    "Priority support"
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      
      <main className="flex-1">
        <section className="py-20 bg-gradient-hero">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Simple, Transparent Pricing
              </h1>
              <p className="text-xl text-muted-foreground">
                Start for free and scale as you grow
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container max-w-4xl">
            <Card className="p-8 md:p-12 text-center bg-gradient-primary text-primary-foreground">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Professional Plan</h2>
                <div className="flex items-baseline justify-center gap-2 mb-4">
                  <span className="text-5xl font-bold">Free</span>
                  <span className="text-xl opacity-90">for limited time</span>
                </div>
                <p className="text-lg opacity-90">
                  Get full access to all features while we're in beta
                </p>
              </div>

              <div className="bg-primary-foreground/10 rounded-lg p-6 mb-8">
                <ul className="space-y-3 text-left max-w-md mx-auto">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link to="/register">
                <Button size="lg" variant="secondary">
                  Get Started Now
                </Button>
              </Link>
            </Card>

            <div className="mt-12 text-center text-muted-foreground">
              <p>
                No credit card required • Full feature access • Cancel anytime
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
