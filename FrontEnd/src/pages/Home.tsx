import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Sparkles, Zap, Brain, TrendingUp, Database, LineChart } from "lucide-react";
import heroImage from "@/assets/hero-analytics.jpg";

export default function Home() {
  const features = [
    {
      icon: Sparkles,
      title: "Intelligent Cleaning",
      description: "Automatically detect and fix data quality issues with AI-powered suggestions."
    },
    {
      icon: Brain,
      title: "Automated EDA",
      description: "Generate comprehensive exploratory data analysis reports in seconds."
    },
    {
      icon: Zap,
      title: "Guided ML",
      description: "Build powerful machine learning models without writing a single line of code."
    },
    {
      icon: TrendingUp,
      title: "Smart Templates",
      description: "One-click analysis templates for common business scenarios."
    },
    {
      icon: Database,
      title: "Data Repository",
      description: "Centralized storage and management for all your datasets."
    },
    {
      icon: LineChart,
      title: "Professional Reports",
      description: "Export beautiful, presentation-ready reports and visualizations."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hero -z-10" />
          <div className="absolute inset-0 -z-10 opacity-20">
            <img src={heroImage} alt="" className="w-full h-full object-cover" />
          </div>
          
          <div className="container relative z-10">
            <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Transform Data Into{" "}
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Insights
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                The all-in-one platform for data analysis. Intelligent cleaning, automated EDA, 
                and guided machine learning - all powered by AI.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start Free Trial
                  </Button>
                </Link>
                <Link to="/demo">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Try Demo
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-muted/50">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything You Need to Analyze Data
              </h2>
              <p className="text-xl text-muted-foreground">
                Powerful features designed for modern data teams
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card 
                  key={index} 
                  className="p-6 hover:shadow-large transition-all duration-300 hover:-translate-y-1 bg-card"
                >
                  <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container">
            <Card className="p-12 bg-gradient-primary text-primary-foreground text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your Data Workflow?
              </h2>
              <p className="text-lg mb-8 opacity-90">
                Join thousands of data professionals using UAM to accelerate their analysis.
              </p>
              <Link to="/register">
                <Button size="lg" variant="secondary">
                  Get Started - Free for Limited Time
                </Button>
              </Link>
            </Card>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
