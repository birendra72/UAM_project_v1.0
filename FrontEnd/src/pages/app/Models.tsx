import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Brain, MoreVertical, Loader2, Award, Calendar, Cpu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState } from "react";

interface ModelItem {
  id: string;
  name: string;
  type: string;
  accuracy: number;
  project: string;
  trained: string;
}

export default function Models() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: models, isLoading } = useQuery<ModelItem[]>({ 
    queryKey: ["models"], 
    queryFn: () => apiClient.getModels() as Promise<ModelItem[]>
  });

  const filteredModels = models?.filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.project.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in text-slate-100 font-body">
        
        {/* Header */}
        <div className="border-b border-slate-900 pb-5">
          <h1 className="text-2xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Model Registry
          </h1>
          <p className="text-xs text-slate-400 font-body mt-0.5">Explore, validate, and manage trained pipeline checkpoints</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search model checkpoints..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-950/40 border-slate-900 text-slate-300 placeholder:text-slate-600 text-xs h-9 focus:border-violet-500/50" 
          />
        </div>

        {/* Models List */}
        <div className="grid gap-3">
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-violet-400" />
              <p className="text-xs text-slate-500 font-mono mt-2">Loading model indexes...</p>
            </div>
          ) : filteredModels.length > 0 ? (
            filteredModels.map((model) => (
              <Card key={model.id} className="p-5 bg-slate-950/40 border border-slate-900 backdrop-blur-sm hover:border-slate-800 transition-all duration-300 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-600/20 to-indigo-600/20 text-violet-400 border border-violet-500/20 flex items-center justify-center shrink-0">
                      <Brain className="h-5 w-5" />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="font-bold text-sm text-slate-200">{model.name}</h3>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          {model.type.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Award className="h-3.5 w-3.5 text-cyan-400" />
                          <span className="font-mono font-bold text-slate-400">Score: {model.accuracy}%</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Cpu className="h-3.5 w-3.5 text-slate-600" />
                          <span>Project: {model.project}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-600" />
                          <span>Trained: {model.trained}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-lg">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 border border-dashed border-slate-900 rounded-xl bg-slate-950/10">
              <Brain className="w-10 h-10 text-slate-700 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-semibold text-slate-400">No Models Found</h3>
              <p className="text-xs text-slate-500">Train models via Project workspace tab.</p>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
