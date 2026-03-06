import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn, UserPlus, Shield, BarChart3, Brain, Users } from "lucide-react";
import icaLogo from "@assets/ica-logo_1772293580977.jpg";

export default function LoginPage() {
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [signupForm, setSignupForm] = useState({ fullName: "", email: "", mobile: "", username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await login(loginForm.username, loginForm.password);
      setTimeout(() => setLocation("/"), 100);
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupLoading) return;
    setSignupLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupForm),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: "Registration Successful", description: data.message });
      setSignupForm({ fullName: "", email: "", mobile: "", username: "", password: "" });
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[hsl(217,91%,20%)] to-[hsl(217,91%,35%)] text-white flex-col justify-center items-center p-12">
        <div className="max-w-md space-y-8 text-center">
          <img
            src={icaLogo}
            alt="ICA Logo"
            className="h-24 mx-auto object-contain rounded-xl shadow-2xl"
            data-testid="img-ica-logo-hero"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ICA - CRM</h1>
            <p className="text-lg text-blue-200 mt-2 font-medium" data-testid="text-tagline">
              Innovation, Consulting & Automation
            </p>
          </div>
          <p className="text-blue-100 text-sm leading-relaxed">
            AI-Powered Performance & Automation Platform for insurance, consulting, and enterprise agencies.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <Brain className="w-6 h-6 mb-2 text-blue-200" />
              <p className="text-sm font-medium">AI Proceeding</p>
              <p className="text-[11px] text-blue-200 mt-1">Smart meeting analysis</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <BarChart3 className="w-6 h-6 mb-2 text-blue-200" />
              <p className="text-sm font-medium">KPI Engine</p>
              <p className="text-[11px] text-blue-200 mt-1">Performance tracking</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <Users className="w-6 h-6 mb-2 text-blue-200" />
              <p className="text-sm font-medium">Team Management</p>
              <p className="text-[11px] text-blue-200 mt-1">Multi-tier hierarchy</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <Shield className="w-6 h-6 mb-2 text-blue-200" />
              <p className="text-sm font-medium">Enterprise Security</p>
              <p className="text-[11px] text-blue-200 mt-1">Role-based access</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3 lg:hidden">
            <img
              src={icaLogo}
              alt="ICA Logo"
              className="h-16 mx-auto object-contain"
              data-testid="img-ica-logo"
            />
            <p className="text-sm text-muted-foreground font-medium tracking-wide" data-testid="text-tagline-mobile">
              Innovation, Consulting & Automation
            </p>
          </div>

          <div className="hidden lg:block text-center">
            <h2 className="text-2xl font-bold tracking-tight">Welcome Back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account or create a new one</p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <Tabs defaultValue="login">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="login" className="flex-1" data-testid="tab-login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1" data-testid="tab-signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username">Username</Label>
                      <Input
                        id="login-username"
                        data-testid="input-username"
                        placeholder="Enter your username"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          data-testid="input-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading}
                      data-testid="button-login"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Signing in...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <LogIn className="w-4 h-4" />
                          Sign In
                        </span>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input
                        data-testid="input-signup-name"
                        placeholder="Enter your full name"
                        value={signupForm.fullName}
                        onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        data-testid="input-signup-email"
                        placeholder="Enter your email"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile Number</Label>
                      <Input
                        type="tel"
                        data-testid="input-signup-mobile"
                        placeholder="Enter your mobile number"
                        value={signupForm.mobile}
                        onChange={(e) => setSignupForm({ ...signupForm, mobile: e.target.value })}
                        required
                        minLength={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        data-testid="input-signup-username"
                        placeholder="Choose a username"
                        value={signupForm.username}
                        onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        data-testid="input-signup-password"
                        placeholder="Choose a password (min 6 chars)"
                        value={signupForm.password}
                        onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={signupLoading}
                      data-testid="button-signup"
                    >
                      {signupLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Registering...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          Sign Up
                        </span>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Your account will require admin approval before you can login.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground space-y-1" data-testid="text-footer">
            <p className="font-medium">ICA - Innovation, Consulting & Automation</p>
            <p>Support: +91 9967969850</p>
          </div>
        </div>
      </div>
    </div>
  );
}
