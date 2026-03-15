import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, Building2, Phone,
  BarChart3, FileText, Brain, LogOut, ChevronDown,
  KeyRound, UserCheck, Download, Briefcase, ArrowUpCircle, Car,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import icaLogo from "@assets/ica-logo_1772293580977.jpg";

const roleLabels: Record<string, string> = {
  MASTER_ADMIN: "Master Admin",
  AGENCY_ADMIN: "Agency Admin",
  TEAM_LEADER: "Team Leader",
  TELE_CALLER: "Telecaller",
};

const roleColors: Record<string, string> = {
  MASTER_ADMIN: "bg-chart-1 text-white dark:text-white",
  AGENCY_ADMIN: "bg-chart-2 text-white dark:text-white",
  TEAM_LEADER: "bg-chart-4 text-white dark:text-white",
  TELE_CALLER: "bg-chart-5 text-white dark:text-white",
};

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (!user) return null;

  const navItems = getNavItems(user.role);
  const initials = user.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={icaLogo}
            alt="ICA"
            className="w-9 h-9 rounded-md object-cover"
            data-testid="img-sidebar-logo"
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm tracking-tight">ICA CRM</h2>
            <p className="text-[10px] text-muted-foreground truncate">Innovation, Consulting & Automation</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={location === item.url}>
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-muted/50 transition-colors"
              data-testid="button-user-menu"
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{user.fullName}</p>
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${roleColors[user.role]}`}>
                  {roleLabels[user.role]}
                </Badge>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setLocation("/change-password")} data-testid="link-change-password">
              <KeyRound className="w-4 h-4 mr-2" />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="pt-3 mt-2 border-t text-center">
          <p className="text-[10px] text-muted-foreground">ICA - Innovation, Consulting & Automation</p>
          <p className="text-[10px] text-muted-foreground">Support: +91 9967969850</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function getNavItems(role: string) {
  const items = [];

  items.push({ title: "Dashboard", url: "/", icon: LayoutDashboard });

  if (role === "MASTER_ADMIN") {
    items.push({ title: "Agencies", url: "/agencies", icon: Building2 });
    items.push({ title: "Users", url: "/users", icon: Users });
    items.push({ title: "Pending Approvals", url: "/approvals", icon: UserCheck });
    items.push({ title: "AI Proceeding", url: "/meetings", icon: Brain });
    items.push({ title: "Upgrade Requests", url: "/upgrade-requests", icon: ArrowUpCircle });
    items.push({ title: "RC Lookup", url: "/rc-lookup", icon: Car });
    items.push({ title: "RC Lookup", url: "/rc-lookup", icon: Car });
  }

  if (role === "AGENCY_ADMIN") {
    items.push({ title: "Users", url: "/users", icon: Users });
    items.push({ title: "Pending Approvals", url: "/approvals", icon: UserCheck });
    items.push({ title: "Leads", url: "/leads", icon: Phone });
    items.push({ title: "Services", url: "/services", icon: Briefcase });
    items.push({ title: "Performance", url: "/performance", icon: BarChart3 });
    items.push({ title: "AI Proceeding", url: "/meetings", icon: Brain });
    items.push({ title: "Plan & Upgrade", url: "/upgrade-requests", icon: ArrowUpCircle });
    items.push({ title: "Reports", url: "/reports", icon: Download });
    items.push({ title: "Audit Logs", url: "/audit-logs", icon: FileText });
    items.push({ title: "RC Lookup", url: "/rc-lookup", icon: Car });
  }

  if (role === "TEAM_LEADER") {
    items.push({ title: "Users", url: "/users", icon: Users });
    items.push({ title: "Leads", url: "/leads", icon: Phone });
    items.push({ title: "Performance", url: "/performance", icon: BarChart3 });
    items.push({ title: "AI Proceeding", url: "/meetings", icon: Brain });
    items.push({ title: "Audit Logs", url: "/audit-logs", icon: FileText });
    items.push({ title: "RC Lookup", url: "/rc-lookup", icon: Car });
  }

  if (role === "TELE_CALLER") {
    items.push({ title: "Leads", url: "/leads", icon: Phone });
    items.push({ title: "My Performance", url: "/performance", icon: BarChart3 });
  }

  return items;
}
