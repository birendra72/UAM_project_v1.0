import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Card } from "@/components/ui/card";
import { Sparkles, BarChart, Cog, Check } from "lucide-react";

export default function Solutions() {
  const solutions = [
    {
      icon: Sparkles,
      title: "Intelligent Data Cleaning",
      description: "Automatically detect and fix data quality issues",
      features: [
        "Smart missing value imputation",
        "Outlier detection and handling",
        "Data type validation",
        "Duplicate removal",
        "Column standardization"
      ]
    },
    {
      icon: BarChart,
      title: "Automated Exploratory Data Analysis",
      description: "Comprehensive insights generated automatically",
      features: [
        "Statistical summaries",
        "Correlation analysis",
        "Distribution visualizations",
        "Feature importance ranking",
        "Trend identification"
      ]
    },
    {
      icon: Cog,
      title: "Guided Machine Learning",
      description: "No-code ML model training and deployment",
      features: [
        "Automated model selection",
        "Hyperparameter optimization",
        "Performance comparison",
        "One-click deployment",
        "Prediction API generation"
      ]
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      
      <main className="flex-1">
        <section className="py-20 bg-gradient-hero">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Powerful Solutions for Modern Data Analysis
              </h1>
              <p className="text-xl text-muted-foreground">
                Everything you need to go from raw data to actionable insights, 
                all in one integrated platform.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container">
            <div className="space-y-16">
              {solutions.map((solution, index) => (
                <Card key={index} className="p-8 md:p-12">
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-shrink-0">
                      <div className="h-16 w-16 rounded-xl bg-gradient-primary flex items-center justify-center">
                        <solution.icon className="h-8 w-8 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl md:text-3xl font-bold mb-3">
                        {solution.title}
                      </h2>
                      <p className="text-lg text-muted-foreground mb-6">
                        {solution.description}
                      </p>
                      <ul className="grid md:grid-cols-2 gap-3">
                        {solution.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
