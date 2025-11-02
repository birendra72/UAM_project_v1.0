import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, Users, ShoppingCart, Heart } from "lucide-react";

export default function AppTemplates() {
  const templates = [
    {
      icon: TrendingUp,
      title: "Sales Forecasting",
      category: "Sales",
      description: "Predict future sales trends using historical data",
      difficulty: "Beginner"
    },
    {
      icon: Users,
      title: "Customer Segmentation",
      category: "Marketing",
      description: "Group customers for targeted campaigns",
      difficulty: "Intermediate"
    },
    {
      icon: ShoppingCart,
      title: "Market Basket Analysis",
      category: "Retail",
      description: "Discover product associations",
      difficulty: "Beginner"
    },
    {
      icon: Heart,
      title: "Churn Prediction",
      category: "Analytics",
      description: "Identify at-risk customers",
      difficulty: "Advanced"
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Analysis Templates</h1>
          <p className="text-muted-foreground">Start a new project with pre-built templates</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search templates..." className="pl-9" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {templates.map((template, index) => (
            <Card key={index} className="p-6 hover:shadow-large transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <template.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{template.category}</Badge>
                  <Badge variant="outline">{template.difficulty}</Badge>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">{template.title}</h3>
              <p className="text-muted-foreground mb-4">{template.description}</p>
              <Button className="w-full">Use Template</Button>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
