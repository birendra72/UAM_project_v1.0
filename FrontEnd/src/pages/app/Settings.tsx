import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, AlertTriangle } from "lucide-react";

export default function Settings() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl text-slate-100 font-body">
        
        {/* Header */}
        <div className="border-b border-slate-900 pb-5">
          <h1 className="text-2xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Account Preferences
          </h1>
          <p className="text-xs text-slate-400 font-body mt-0.5">Customize your profile configurations and security credentials</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-900/50 border border-slate-900 p-1 rounded-xl max-w-md">
            <TabsTrigger value="profile" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400 transition-all">
              <User className="h-3.5 w-3.5 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400 transition-all">
              <Shield className="h-3.5 w-3.5 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="danger" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-rose-400 transition-all">
              <AlertTriangle className="h-3.5 w-3.5 mr-2" />
              Danger
            </TabsTrigger>
          </TabsList>

          {/* Profile Section */}
          <TabsContent value="profile" className="space-y-4 mt-6">
            <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm rounded-xl">
              <h3 className="font-display font-bold text-slate-200 text-sm mb-4">Profile Information</h3>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Full Name</Label>
                  <Input id="name" defaultValue="John Doe" className="bg-slate-900 border-slate-800 text-slate-300 text-xs h-9 focus:border-violet-500/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Email Address</Label>
                  <Input id="email" type="email" defaultValue="john@example.com" className="bg-slate-900 border-slate-800 text-slate-300 text-xs h-9 focus:border-violet-500/50" />
                </div>
                <div className="flex justify-end pt-2">
                  <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs h-8">
                    Save Changes
                  </Button>
                </div>
              </form>
            </Card>
          </TabsContent>

          {/* Security Section */}
          <TabsContent value="security" className="space-y-4 mt-6">
            <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm rounded-xl">
              <h3 className="font-display font-bold text-slate-200 text-sm mb-4">Update Password</h3>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Current Password</Label>
                  <Input id="current-password" type="password" className="bg-slate-900 border-slate-800 text-slate-300 text-xs h-9 focus:border-violet-500/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-xs text-slate-400 font-semibold uppercase tracking-wider">New Password</Label>
                  <Input id="new-password" type="password" className="bg-slate-900 border-slate-800 text-slate-300 text-xs h-9 focus:border-violet-500/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password" className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Confirm New Password</Label>
                  <Input id="confirm-new-password" type="password" className="bg-slate-900 border-slate-800 text-slate-300 text-xs h-9 focus:border-violet-500/50" />
                </div>
                <div className="flex justify-end pt-2">
                  <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs h-8">
                    Update Password
                  </Button>
                </div>
              </form>
            </Card>
          </TabsContent>

          {/* Danger Zone Section */}
          <TabsContent value="danger" className="space-y-4 mt-6">
            <Card className="p-6 bg-slate-950/40 border border-rose-950/45 backdrop-blur-sm rounded-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1.5px] bg-rose-500/20" />
              <h3 className="font-display font-bold text-rose-400 text-sm mb-2">Delete Account Checkpoint</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed font-body">
                Once you confirm account deletion, all active project models, parsed datasets, and historical training statistics will be permanently purged from Supabase S3 storage nodes. This action cannot be reversed.
              </p>
              <div className="flex justify-start">
                <Button variant="destructive" className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs h-8">
                  Permanently Delete Account
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
