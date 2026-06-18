import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, Users, ShoppingCart, Heart, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AppTemplates() {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const templates = [
    {
      icon: TrendingUp,
      title: "Sales Forecasting",
      category: "Sales",
      description: "Analyze historical demand to model product metrics forecasts.",
      difficulty: "Beginner"
    },
    {
      icon: Users,
      title: "Customer Segmentation",
      category: "Marketing",
      description: "Cluster profiles using k-means targeting frameworks.",
      difficulty: "Intermediate"
    },
    {
      icon: ShoppingCart,
      title: "Market Basket Analysis",
      category: "Retail",
      description: "Identify product associations via Apriori rules engines.",
      difficulty: "Beginner"
    },
    {
      icon: Heart,
      title: "Churn Prediction",
      category: "Analytics",
      description: "Audit pipeline feature importances to flag user churn probability.",
      difficulty: "Advanced"
    },
  ];

  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDifficultyStyle = (level: string) => {
    switch (level.toLowerCase()) {
      case 'beginner':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'intermediate':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'advanced':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const handleUseTemplate = (title: string, desc: string) => {
    navigate(`/app/projects?create=true&name=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in text-slate-100 font-body">
        
        {/* Header */}
        <div className="border-b border-slate-900 pb-5">
          <h1 className="text-2xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Analysis Templates
          </h1>
          <p className="text-xs text-slate-400 font-body mt-0.5">Initialize a pre-configured project workflow template</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search templates..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-950/40 border-slate-900 text-slate-300 placeholder:text-slate-600 text-xs h-9 focus:border-violet-500/50" 
          />
        </div>

        {/* Templates Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {filteredTemplates.map((template, index) => {
            const IconComponent = template.icon;
            return (
              <Card key={index} className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm hover:border-slate-800 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between rounded-xl group">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-600/20 to-indigo-600/20 text-violet-400 border border-violet-500/20 flex items-center justify-center">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-slate-900 text-slate-400 border border-slate-850">
                        {template.category.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono border ${getDifficultyStyle(template.difficulty)}`}>
                        {template.difficulty.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-base text-slate-200 group-hover:text-violet-400 transition-colors flex items-center gap-1.5">
                    {template.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed mb-6">{template.description}</p>
                </div>

                <Button 
                  onClick={() => handleUseTemplate(template.title, template.description)}
                  className="w-full text-xs bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-200 hover:text-slate-100 font-semibold h-9"
                >
                  Use Template
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
