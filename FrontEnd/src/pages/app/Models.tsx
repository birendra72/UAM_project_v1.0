import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Brain, MoreVertical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export default function Models() {
  const { data: models, isLoading } = useQuery({ queryKey: ["models"], queryFn: () => apiClient.getModels() });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Models</h1>
          <p className="text-muted-foreground">View and manage your trained models</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search models..." className="pl-9" />
        </div>

        <div className="grid gap-4">
          {isLoading ? (
            <p>Loading models...</p>
          ) : (
            (models as any[])?.map((model: any) => (
            <Card key={model.id} className="p-6 hover:shadow-medium transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <Brain className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{model.name}</h3>
                      <Badge variant="secondary">{model.type}</Badge>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Accuracy: {model.accuracy}%</span>
                      <span>•</span>
                      <span>{model.project}</span>
                      <span>•</span>
                      <span>Trained {model.trained}</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
