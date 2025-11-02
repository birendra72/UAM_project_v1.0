import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Database, TrendingUp, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export default function Demo() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      
      <main className="flex-1">
        <section className="py-12 bg-gradient-hero">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Interactive Demo
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                Experience UAM with a sample retail dataset
              </p>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container max-w-6xl">
            <Card className="p-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                  <TabsTrigger value="predictions">Predictions</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 mt-6">
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 bg-gradient-primary text-primary-foreground">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm opacity-90">Total Records</span>
                        <Database className="h-4 w-4" />
                      </div>
                      <div className="text-2xl font-bold">12,450</div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Data Quality</span>
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="text-2xl font-bold">98.5%</div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Insights Found</span>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="text-2xl font-bold">47</div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Models Trained</span>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="text-2xl font-bold">3</div>
                    </Card>
                  </div>

                  <Card className="p-6 bg-muted/50">
                    <h3 className="text-lg font-semibold mb-4">Sample Dataset: Retail Sales</h3>
                    <p className="text-muted-foreground mb-4">
                      This demo uses a retail sales dataset with transaction data, customer information, 
                      and product details. Explore how UAM automatically cleans, analyzes, and builds 
                      predictive models from your data.
                    </p>
                    <div className="flex gap-4">
                      <Link to="/register">
                        <Button>Start with Your Data</Button>
                      </Link>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="data" className="space-y-6 mt-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Data Preview</h3>
                    <div className="text-sm text-muted-foreground mb-4">
                      Showing 5 of 12,450 records
                    </div>
                    <div className="overflow-x-auto">
                      <div className="text-sm text-center py-12 text-muted-foreground">
                        Interactive data table would be displayed here with sample retail data
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="analysis" className="space-y-6 mt-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Automated Insights</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2">📈 Sales Trend</h4>
                        <p className="text-sm text-muted-foreground">
                          Revenue shows a strong upward trend with 15% growth quarter-over-quarter
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2">🎯 Top Products</h4>
                        <p className="text-sm text-muted-foreground">
                          Electronics category accounts for 34% of total revenue
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2">👥 Customer Segments</h4>
                        <p className="text-sm text-muted-foreground">
                          Identified 4 distinct customer segments based on purchase behavior
                        </p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="predictions" className="space-y-6 mt-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Model Performance</h3>
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">Random Forest Regressor</h4>
                          <Badge>Best Model</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Accuracy</div>
                            <div className="font-semibold">94.2%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">RMSE</div>
                            <div className="font-semibold">0.142</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">R² Score</div>
                            <div className="font-semibold">0.887</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
