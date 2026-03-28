import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn, Shield, Zap, Users, BarChart3 } from "lucide-react";
import aplmLogo from "@assets/aplm.jpeg";

export default function LoginPage() {
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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

  return (
    <div style={{minHeight:"100vh",display:"flex",background:"linear-gradient(160deg,#1e0a3c 0%,#2d1b69 50%,#1a1035 100%)",fontFamily:"'Segoe UI',system-ui,sans-serif",position:"relative",overflow:"hidden"}}>
      <style>{`
        @keyframes float1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(28px,-18px) scale(1.04)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,22px)}}
        @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(16px,16px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse-ring{0%{transform:scale(0.95);opacity:0.5}50%{transform:scale(1.06);opacity:0.15}100%{transform:scale(0.95);opacity:0.5}}
        .aplm-input{width:100%;padding:11px 14px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(167,139,250,0.25);border-radius:8px;color:#fff;font-size:14px;outline:none;transition:all 0.2s;box-sizing:border-box;}
        .aplm-input::placeholder{color:rgba(255,255,255,0.25);}
        .aplm-input:focus{border-color:rgba(167,139,250,0.7);background:rgba(167,139,250,0.08);box-shadow:0 0 0 3px rgba(124,58,237,0.15);}
        .aplm-label{display:block;font-size:11px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:7px;}
        .aplm-submit{width:100%;padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:white;box-shadow:0 4px 16px rgba(124,58,237,0.4);}
        .aplm-submit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 24px rgba(124,58,237,0.55);}
        .aplm-submit:disabled{opacity:0.6;cursor:not-allowed;}
        .feature-row{display:flex;align-items:center;gap:12px;}
        .feature-icon{width:36px;height:36px;border-radius:8px;background:rgba(139,92,246,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .spin{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.7s linear infinite;}
        @media(min-width:1024px){.mobile-logo{display:none!important}.left-panel{display:flex!important}.divider{display:block!important}}
      `}</style>

      {/* Background orbs */}
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        <div style={{position:"absolute",top:"-10%",left:"-8%",width:"500px",height:"500px",borderRadius:"50%",background:"radial-gradient(circle,rgba(139,92,246,0.18) 0%,transparent 70%)",animation:"float1 9s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"-15%",right:"-8%",width:"580px",height:"580px",borderRadius:"50%",background:"radial-gradient(circle,rgba(109,40,217,0.15) 0%,transparent 70%)",animation:"float2 11s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:"35%",right:"20%",width:"260px",height:"260px",borderRadius:"50%",background:"radial-gradient(circle,rgba(167,139,250,0.1) 0%,transparent 70%)",animation:"float3 7s ease-in-out infinite"}}/>
      </div>

      {/* LEFT PANEL */}
      <div className="left-panel" style={{display:"none",width:"52%",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"60px",position:"relative"}}>
        <div style={{maxWidth:"440px",width:"100%",animation:"fadeUp 0.8s ease forwards"}}>

          {/* Logo + brand */}
          <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"44px"}}>
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",inset:"-5px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",opacity:0.3,animation:"pulse-ring 3s ease-in-out infinite"}}/>
              <img src={aplmLogo} alt="APLM" style={{width:"56px",height:"56px",borderRadius:"50%",objectFit:"cover",position:"relative",border:"2px solid rgba(167,139,250,0.4)"}}/>
            </div>
            <div>
              <h1 style={{margin:0,fontSize:"22px",fontWeight:800,color:"#fff",letterSpacing:"-0.3px"}}>APLM CRM</h1>
              <p style={{margin:0,fontSize:"12px",color:"#a78bfa",fontWeight:600,marginTop:"2px"}}>APLM Sales & Marketing</p>
            </div>
          </div>

          {/* Headline */}
          <div style={{marginBottom:"36px"}}>
            <h2 style={{margin:"0 0 14px",fontSize:"38px",fontWeight:800,color:"#fff",lineHeight:1.2,letterSpacing:"-0.5px"}}>
              Sell Smarter.<br/>
              <span style={{color:"#a78bfa"}}>Close Faster.</span>
            </h2>
            <p style={{margin:0,fontSize:"14px",color:"rgba(255,255,255,0.45)",lineHeight:1.75,maxWidth:"340px"}}>End-to-end insurance CRM with AI tools, smart follow-ups, and real-time performance tracking for motor & general insurance agencies.</p>
          </div>

          {/* Features */}
          <div style={{display:"flex",flexDirection:"column",gap:"14px",marginBottom:"36px"}}>
            {[
              {icon:<Zap size={16} color="#a78bfa"/>,title:"AI Smart Tools",desc:"Remarks, follow-ups & lead scoring"},
              {icon:<BarChart3 size={16} color="#a78bfa"/>,title:"Performance Insights",desc:"Real-time KPI & team tracking"},
              {icon:<Users size={16} color="#a78bfa"/>,title:"Team Hierarchy",desc:"Admin, TL & telecaller roles"},
              {icon:<Shield size={16} color="#a78bfa"/>,title:"Secure Access",desc:"Role-based, enterprise-grade"},
            ].map((f,i)=>(
              <div key={i} className="feature-row">
                <div className="feature-icon">{f.icon}</div>
                <div>
                  <p style={{margin:0,fontSize:"13px",fontWeight:600,color:"rgba(255,255,255,0.9)"}}>{f.title}</p>
                  <p style={{margin:0,fontSize:"11px",color:"rgba(255,255,255,0.35)",marginTop:"2px"}}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{display:"flex",gap:"28px",padding:"16px 20px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(167,139,250,0.15)",borderRadius:"10px"}}>
            {[["AI","Powered"],["Motor","Focused"],["100%","Cloud"]].map(([val,label],i)=>(
              <div key={i}>
                <p style={{margin:0,fontSize:"18px",fontWeight:800,color:"#a78bfa"}}>{val}</p>
                <p style={{margin:0,fontSize:"10px",color:"rgba(255,255,255,0.3)",marginTop:"2px"}}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="divider" style={{display:"none",width:"1px",background:"linear-gradient(to bottom,transparent,rgba(139,92,246,0.2),transparent)",flexShrink:0}}/>

      {/* RIGHT PANEL */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"32px 24px"}}>
        <div style={{width:"100%",maxWidth:"380px",animation:"fadeUp 0.8s ease 0.2s both"}}>

          {/* Mobile logo */}
          <div className="mobile-logo" style={{textAlign:"center",marginBottom:"32px"}}>
            <div style={{position:"relative",display:"inline-block"}}>
              <div style={{position:"absolute",inset:"-5px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",opacity:0.3}}/>
              <img src={aplmLogo} alt="APLM" style={{width:"64px",height:"64px",borderRadius:"50%",objectFit:"cover",position:"relative",border:"2px solid rgba(167,139,250,0.4)"}}/>
            </div>
            <p style={{margin:"12px 0 2px",fontSize:"18px",fontWeight:800,color:"#fff"}}>APLM CRM</p>
            <p style={{margin:0,fontSize:"12px",color:"#a78bfa",fontWeight:600}}>APLM Sales & Marketing</p>
          </div>

          {/* Login card */}
          <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:"16px",padding:"32px",backdropFilter:"blur(12px)"}}>
            <div style={{marginBottom:"24px"}}>
              <h2 style={{margin:"0 0 5px",fontSize:"22px",fontWeight:800,color:"#fff",letterSpacing:"-0.3px"}}>Welcome Back</h2>
              <p style={{margin:0,fontSize:"13px",color:"rgba(167,139,250,0.7)"}}>Sign in to your APLM CRM account</p>
            </div>

            <form onSubmit={handleLogin} style={{display:"flex",flexDirection:"column",gap:"16px"}}>
              <div>
                <label className="aplm-label">Username</label>
                <input
                  className="aplm-input"
                  placeholder="Enter your username"
                  value={loginForm.username}
                  onChange={(e)=>setLoginForm({...loginForm,username:e.target.value})}
                  required autoFocus
                />
              </div>
              <div>
                <label className="aplm-label">Password</label>
                <div style={{position:"relative"}}>
                  <input
                    className="aplm-input"
                    type={showPassword?"text":"password"}
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e)=>setLoginForm({...loginForm,password:e.target.value})}
                    style={{paddingRight:"44px"}}
                    required
                  />
                  <button type="button" onClick={()=>setShowPassword(!showPassword)} style={{position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(167,139,250,0.5)",padding:"4px",display:"flex",alignItems:"center"}}>
                    {showPassword?<EyeOff size={15}/>:<Eye size={15}/>}
                  </button>
                </div>
              </div>
              <button type="submit" className="aplm-submit" disabled={loading} style={{marginTop:"4px"}}>
                {loading?<><div className="spin"/>Signing in...</>:<><LogIn size={15}/>Sign In</>}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div style={{textAlign:"center",marginTop:"22px"}}>
            <p style={{margin:"0 0 3px",fontSize:"11px",fontWeight:600,color:"rgba(167,139,250,0.5)",letterSpacing:"0.05em"}}>APLM Sales & Marketing</p>
            <p style={{margin:0,fontSize:"11px",color:"rgba(255,255,255,0.2)"}}>Powered by ICA — Innovation, Consulting & Automation</p>
            <p style={{margin:"3px 0 0",fontSize:"11px",color:"rgba(255,255,255,0.2)"}}>Support: support@icaweb.in</p>
          </div>
        </div>
      </div>
    </div>
  );
}
