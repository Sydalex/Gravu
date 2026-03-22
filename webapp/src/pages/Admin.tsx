import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  RefreshCw,
  Users,
  CreditCard,
  BarChart3,
  DollarSign,
  Settings,
  Sparkles,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  proSubscribers: number;
  totalConversions: number;
  mrr: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  credits: number;
  plan: string;
  conversionCount: number;
}

const sidebarItems = [
  { section: "OVERVIEW", items: [
    { label: "Users", icon: Users, id: "users" },
    { label: "Conversions", icon: BarChart3, id: "conversions" },
    { label: "Revenue", icon: DollarSign, id: "revenue" },
  ]},
  { section: "CONTROLS", items: [
    { label: "AI Settings", icon: Sparkles, id: "ai-settings" },
    { label: "Settings", icon: Settings, id: "settings" },
  ]},
];

function PlanBadge({ plan, isAdmin }: { plan: string; isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <span className="inline-flex items-center rounded-full border border-[#edcbbd] bg-[#fcf2ee] px-2.5 py-0.5 text-[11px] font-semibold text-[#c96240]">
        ADMIN
      </span>
    );
  }
  if (plan === "pro") {
    return (
      <span className="inline-flex items-center rounded-full border border-[#c8edde] bg-[#ebfaf4] px-2.5 py-0.5 text-[11px] font-semibold text-[#10b77f]">
        ⬡ PRO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[#d9d8d3] bg-[#f5f3ee] px-2.5 py-0.5 text-[11px] font-semibold text-[#82817d]">
      FREE
    </span>
  );
}

function formatJoinDate(iso: string) {
  const d = new Date(iso);
  return `Joined ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

export default function Admin() {
  const queryClient = useQueryClient();
  const [activeTab] = useState("users");
  const [creditDialogUser, setCreditDialogUser] = useState<AdminUser | null>(null);
  const [creditAmount, setCreditAmount] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
  });

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<AdminUser[]>("/api/admin/users"),
  });

  const creditsMutation = useMutation({
    mutationFn: (params: { userId: string; amount: number; operation: "add" | "set" }) =>
      api.post(`/api/admin/users/${params.userId}/credits`, {
        amount: params.amount,
        operation: params.operation,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      setCreditDialogUser(null);
      setCreditAmount("");
    },
  });

  const handleCredits = (operation: "add" | "set") => {
    if (!creditDialogUser || !creditAmount) return;
    creditsMutation.mutate({
      userId: creditDialogUser.id,
      amount: Number(creditAmount),
      operation,
    });
  };

  return (
    <div className="flex min-h-screen bg-background pt-[52px]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-[52px] bottom-0 w-[220px] border-r border-border bg-secondary/60 flex flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="text-[18px] font-bold tracking-[-0.5px] text-[#3d3929]">Gravu</span>
          <span className="inline-flex items-center rounded-full border border-[#edcbbd] bg-[#fcf2ee] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#c96240]">
            ADMIN
          </span>
        </div>

        <nav className="flex-1 px-3">
          {sidebarItems.map((group) => (
            <div key={group.section} className="mb-4">
              <p className="mb-2 px-2 font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-muted-foreground">
                {group.section}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === activeTab;
                return (
                  <button
                    key={item.id}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium transition-colors",
                      isActive
                        ? "border border-[#c8edde] bg-[#ebfaf4] text-[#10b77f]"
                        : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="ml-[220px] flex-1 p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.84px] text-[#3d3929]">
              Users
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Manage accounts, credits, and subscriptions.
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => refetchUsers()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stat cards */}
        {statsLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mb-6 grid grid-cols-4 gap-4">
            <StatCard
              label="Total Users"
              value={stats?.totalUsers ?? 0}
              sub={`↑ ${stats?.totalUsers ?? 0} this week`}
              subColor="text-[#10b77f]"
            />
            <StatCard
              label="Pro Subscribers"
              value={stats?.proSubscribers ?? 0}
              sub={
                stats && stats.totalUsers > 0
                  ? `${Math.round((stats.proSubscribers / stats.totalUsers) * 100)}% of users`
                  : "0% of users"
              }
              subColor="text-[#10b77f]"
            />
            <StatCard
              label="Conversions"
              value={stats?.totalConversions ?? 0}
              sub={`↑ ${stats?.totalConversions ?? 0} today`}
              subColor="text-[#10b77f]"
            />
            <StatCard
              label="MRR"
              value={`€${stats?.mrr ?? 0}`}
              sub="Stripe live pending"
              subColor="text-muted-foreground"
            />
          </div>
        )}

        {/* Users table */}
        <div className="rounded-[16px] border border-[#d9d8d3] bg-[#f5f3ee]">
          <div className="flex items-center justify-between border-b border-[#d9d8d3] px-5 py-4">
            <span className="text-[14px] font-semibold text-[#3d3929]">All Users</span>
            <span className="rounded-full border border-[#d9d8d3] bg-background px-2.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              {users?.length ?? 0} TOTAL
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] border-b border-[#d9d8d3] px-5 py-2.5">
            {["USER", "PLAN", "CREDITS", "CONVERSIONS", "ACTIONS"].map((h) => (
              <span
                key={h}
                className="font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-muted-foreground"
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {usersLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            users?.map((user) => (
              <div
                key={user.id}
                className="grid h-[52px] grid-cols-[2fr_1fr_1fr_1fr_1.2fr] items-center border-b border-[#d9d8d3] px-5 last:border-b-0"
              >
                <div>
                  <p className="text-[13px] font-medium text-[#3d3929]">{user.email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatJoinDate(user.createdAt)}
                  </p>
                </div>
                <div>
                  <PlanBadge plan={user.plan} isAdmin={user.isAdmin} />
                </div>
                <span className="text-[13px] font-semibold text-[#3d3929]">
                  {user.isAdmin ? "∞" : user.credits}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {user.conversionCount}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCreditDialogUser(user);
                      setCreditAmount("");
                    }}
                    className="rounded-[8px] border border-[#c8edde] bg-[#ebfaf4] px-3 py-1 text-[11px] font-medium text-[#10b77f] transition-colors hover:bg-[#d6f5e8]"
                  >
                    Credits
                  </button>
                  <button className="rounded-[8px] border border-[#d9d8d3] px-3 py-1 text-[11px] font-medium text-[#82817d] transition-colors hover:bg-secondary">
                    View
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Credits Dialog */}
      <Dialog
        open={!!creditDialogUser}
        onOpenChange={(open) => {
          if (!open) {
            setCreditDialogUser(null);
            setCreditAmount("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adjust Credits — {creditDialogUser?.email}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Current balance:{" "}
              <span className="font-semibold text-foreground">
                {creditDialogUser?.isAdmin ? "∞" : creditDialogUser?.credits}
              </span>
            </p>

            <Input
              type="number"
              placeholder="Amount"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
            />

            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => handleCredits("add")}
                disabled={!creditAmount || creditsMutation.isPending}
              >
                {creditsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Add Credits
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleCredits("set")}
                disabled={!creditAmount || creditsMutation.isPending}
              >
                Set Credits
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: number | string;
  sub: string;
  subColor: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#d9d8d3] bg-[#f5f3ee] p-5">
      <p className="font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-extrabold leading-none text-[#3d3929]">
        {value}
      </p>
      <p className={cn("mt-1 text-[10px]", subColor)}>{sub}</p>
    </div>
  );
}
