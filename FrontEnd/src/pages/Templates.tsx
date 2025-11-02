import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, ShoppingCart, Heart, DollarSign, Zap } from "lucide-react";

export default function Templates() {
  const templates = [
    {
      icon: TrendingUp,
      title: "Sales Forecasting",
      category: "Sales",
      description: "Predict future sales trends using historical data and seasonal patterns.",
      uses: "1.2k"
    },
    {
      icon: Users,
      title: "Customer Segmentation",
      category: "Marketing",
      description: "Group customers based on behavior and demographics for targeted campaigns.",
      uses: "980"
    },
    {
      icon: ShoppingCart,
      title: "Market Basket Analysis",
      category: "Retail",
      description: "Discover product associations and cross-selling opportunities.",
      uses: "756"
    },
    {
      icon: Heart,
      title: "Churn Prediction",
      category: "Analytics",
      description: "Identify customers at risk of leaving before they do.",
      uses: "1.5k"
    },
    {
      icon: DollarSign,
      title: "Price Optimization",
      category: "Finance",
      description: "Find optimal pricing strategies to maximize revenue.",
      uses: "642"
    },
    {
      icon: Zap,
      title: "Demand Forecasting",
      category: "Operations",
      description: "Predict product demand to optimize inventory levels.",
      uses: "890"
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
                Smart Analysis Templates
              </h1>
              <p className="text-xl text-muted-foreground">
                Pre-built templates for common business scenarios. One-click analysis 
                powered by AI.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template, index) => (
                <Card key={index} className="p-6 hover:shadow-large transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <template.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <Badge variant="secondary">{template.category}</Badge>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{template.title}</h3>
                  <p className="text-muted-foreground mb-4">{template.description}</p>
                  <div className="text-sm text-muted-foreground">
                    {template.uses} uses
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
