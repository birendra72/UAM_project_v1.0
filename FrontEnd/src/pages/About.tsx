import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Card } from "@/components/ui/card";
import { Target, Heart, Lightbulb } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      
      <main className="flex-1">
        <section className="py-20 bg-gradient-hero">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                About Universal Analyst Model
              </h1>
              <p className="text-xl text-muted-foreground">
                We're on a mission to democratize data analytics and make advanced 
                machine learning accessible to everyone.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container max-w-4xl">
            <div className="prose prose-lg mx-auto mb-16">
              <p className="text-lg text-muted-foreground">
                Universal Analyst Model (UAM) was born from a simple observation: 
                data analysis is too complex and time-consuming. We believe that 
                powerful analytics should be accessible to everyone, not just data 
                scientists with years of experience.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <Card className="p-6 text-center">
                <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center mx-auto mb-4">
                  <Target className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Our Mission</h3>
                <p className="text-muted-foreground">
                  Empower every professional to make data-driven decisions with 
                  confidence and ease.
                </p>
              </Card>

              <Card className="p-6 text-center">
                <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center mx-auto mb-4">
                  <Lightbulb className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Our Vision</h3>
                <p className="text-muted-foreground">
                  A world where advanced analytics and ML are as easy to use as 
                  spreadsheet software.
                </p>
              </Card>

              <Card className="p-6 text-center">
                <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center mx-auto mb-4">
                  <Heart className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Our Values</h3>
                <p className="text-muted-foreground">
                  Simplicity, innovation, and user empowerment guide everything 
                  we build.
                </p>
              </Card>
            </div>

            <Card className="p-8 bg-muted/50">
              <h2 className="text-2xl font-bold mb-4">Our Team</h2>
              <p className="text-muted-foreground">
                We're a passionate team of data scientists, engineers, and designers 
                who believe in the power of data to transform businesses. With decades 
                of combined experience in analytics, machine learning, and product 
                development, we're committed to building the best data analysis 
                platform on the market.
              </p>
            </Card>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
