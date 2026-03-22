import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Users,
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

type FilterId = "all" | "admins" | "pro" | "low-credits";

const filters: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All Users" },
  { id: "admins", label: "Admins" },
  { id: "pro", label: "Pro" },
  { id: "low-credits", label: "Low Credits" },
];

function formatJoinDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeJoinDate(iso: string) {
  const date = new Date(iso);
  return `Joined ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

function PlanBadge({ plan, isAdmin }: { plan: string; isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#edcbbd] bg-[#fcf2ee] px-2.5 py-1 text-[11px] font-semibold text-[#c96240]">
        <Shield className="h-3 w-3" />
        Admin
      </span>
    );
  }

  if (plan === "pro") {
    return (
      <span className="inline-flex items-center rounded-full border border-[#ead8b7] bg-[#f7f0e3] px-2.5 py-1 text-[11px] font-semibold text-[#8f6a1d]">
        Pro
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-[#d9d8d3] bg-[#f5f3ee] px-2.5 py-1 text-[11px] font-semibold text-[#82817d]">
      Free
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  meta: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#dfd8cc] bg-[#f8f4ec] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-[34px] font-black leading-none tracking-[-1.2px] text-[#332e24]">
            {value}
          </p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#eadfce] bg-background text-[#c96240]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">{meta}</p>
    </div>
  );
}

export default function Admin() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "stats"] }),
      ]);
      setCreditDialogUser(null);
      setCreditAmount("");
    },
  });

  const allUsers = users ?? [];
  const filteredUsers = allUsers.filter((user) => {
    const matchesSearch =
      search.trim().length === 0 ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.name.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "admins") return user.isAdmin;
    if (activeFilter === "pro") return !user.isAdmin && user.plan === "pro";
    if (activeFilter === "low-credits") return !user.isAdmin && user.credits <= 3;
    return true;
  });

  useEffect(() => {
    if (!filteredUsers.length) {
      setSelectedUserId(null);
      return;
    }

    const exists = filteredUsers.some((user) => user.id === selectedUserId);
    if (!exists) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId]);

  const selectedUser =
    filteredUsers.find((user) => user.id === selectedUserId) ??
    allUsers.find((user) => user.id === selectedUserId) ??
    null;

  const lowCreditCount = allUsers.filter((user) => !user.isAdmin && user.credits <= 3).length;
  const adminCount = allUsers.filter((user) => user.isAdmin).length;

  const handleCredits = (operation: "add" | "set") => {
    if (!creditDialogUser || !creditAmount) return;

    creditsMutation.mutate({
      userId: creditDialogUser.id,
      amount: Number(creditAmount),
      operation,
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f8f6] pt-[52px]">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-[#e6ddcf] bg-gradient-to-br from-[#fbf7ef] via-[#f7f0e7] to-[#f4ece1]">
          <div className="flex flex-col gap-6 px-6 py-7 md:px-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[720px]">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#edcbbd] bg-[#fcf2ee] px-3 py-1 text-[10px] font-semibold uppercase tracking-[1.6px] text-[#c96240]">
                <Sparkles className="h-3.5 w-3.5" />
                Admin Control
              </div>
              <h1 className="max-w-[10ch] text-[38px] font-black leading-[0.95] tracking-[-1.8px] text-[#332e24] sm:text-[52px]">
                Run users, credits, and support from one screen.
              </h1>
              <p className="mt-4 max-w-[62ch] text-[14px] leading-6 text-[#6f695f] sm:text-[15px]">
                This is the operator view for staging. Filter accounts, inspect plan state, and
                adjust credits without hopping across placeholder tabs.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 rounded-2xl border-[#d9d0c2] bg-background/80 px-5"
                onClick={() => refetchUsers()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </Button>
            </div>
          </div>
        </section>

        {statsLoading ? (
          <div className="flex h-28 items-center justify-center rounded-[22px] border border-[#dfd8cc] bg-[#f8f4ec]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label="Total Users"
              value={stats?.totalUsers ?? 0}
              meta={`${adminCount} admins across staging`}
            />
            <StatCard
              icon={Sparkles}
              label="Pro Subscribers"
              value={stats?.proSubscribers ?? 0}
              meta={`${stats?.totalUsers ? Math.round((stats.proSubscribers / stats.totalUsers) * 100) : 0}% of current accounts`}
            />
            <StatCard
              icon={CreditCard}
              label="Conversions"
              value={stats?.totalConversions ?? 0}
              meta={`${lowCreditCount} users at 3 credits or below`}
            />
            <StatCard
              icon={Shield}
              label="MRR"
              value={`€${stats?.mrr ?? 0}`}
              meta="Estimated from active Pro subscriptions"
            />
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]">
          <div className="overflow-hidden rounded-[24px] border border-[#dfd8cc] bg-[#f8f4ec]">
            <div className="border-b border-[#dfd8cc] px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                    User Workspace
                  </p>
                  <h2 className="mt-2 text-[26px] font-black tracking-[-0.9px] text-[#332e24]">
                    Accounts
                  </h2>
                </div>

                <div className="flex flex-col gap-3 lg:min-w-[420px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by email or name"
                      className="h-11 rounded-2xl border-[#d8d0c5] bg-background pl-10"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {filters.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setActiveFilter(filter.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                          activeFilter === filter.id
                            ? "border-[#c96240] bg-[#fcf2ee] text-[#c96240]"
                            : "border-[#d9d0c2] bg-background text-[#6f695f] hover:bg-[#f4ede4]"
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1.6fr)_110px_90px_110px] gap-3 border-b border-[#dfd8cc] px-5 py-3 text-[10px] uppercase tracking-[1.8px] text-muted-foreground sm:px-6">
              <span>User</span>
              <span>Plan</span>
              <span>Credits</span>
              <span>Conversions</span>
            </div>

            {usersLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-[15px] font-medium text-[#332e24]">No users match this view.</p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Clear the search or switch filters to inspect another segment.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#e4ddd0]">
                {filteredUsers.map((user) => {
                  const isSelected = user.id === selectedUser?.id;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1.6fr)_110px_90px_110px] gap-3 px-5 py-4 text-left transition-colors sm:px-6",
                        isSelected ? "bg-[#f2e8db]" : "hover:bg-[#f4ede4]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#eadfce] bg-background text-[13px] font-bold text-[#332e24]">
                            {(user.name || user.email).slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[#332e24]">
                              {user.name || user.email}
                            </p>
                            <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <PlanBadge plan={user.plan} isAdmin={user.isAdmin} />
                      </div>
                      <div className="flex items-center text-[14px] font-semibold text-[#332e24]">
                        {user.isAdmin ? "∞" : user.credits}
                      </div>
                      <div className="flex items-center text-[14px] text-[#6f695f]">
                        {user.conversionCount}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="rounded-[24px] border border-[#dfd8cc] bg-[#f8f4ec] p-5 sm:p-6 xl:sticky xl:top-[84px] xl:h-fit">
            {selectedUser ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Selected User
                    </p>
                    <h3 className="mt-2 text-[26px] font-black tracking-[-0.8px] text-[#332e24]">
                      {selectedUser.name || "Account"}
                    </h3>
                  </div>
                  <PlanBadge plan={selectedUser.plan} isAdmin={selectedUser.isAdmin} />
                </div>

                <div className="mt-5 rounded-[20px] border border-[#e5dbc9] bg-background/90 p-4">
                  <p className="truncate text-[14px] font-medium text-[#332e24]">{selectedUser.email}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {formatRelativeJoinDate(selectedUser.createdAt)}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[18px] border border-[#e5dbc9] bg-background/80 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Credits
                    </p>
                    <p className="mt-2 text-[28px] font-black leading-none tracking-[-1px] text-[#332e24]">
                      {selectedUser.isAdmin ? "∞" : selectedUser.credits}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[#e5dbc9] bg-background/80 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Conversions
                    </p>
                    <p className="mt-2 text-[28px] font-black leading-none tracking-[-1px] text-[#332e24]">
                      {selectedUser.conversionCount}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[#e5dbc9] bg-background/80 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Joined
                    </p>
                    <p className="mt-2 text-[16px] font-semibold text-[#332e24]">
                      {formatJoinDate(selectedUser.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    className="h-11 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      setCreditDialogUser(selectedUser);
                      setCreditAmount("");
                    }}
                  >
                    Adjust Credits
                  </Button>
                  <div className="rounded-[18px] border border-dashed border-[#d9d0c2] px-4 py-3 text-[12px] leading-5 text-muted-foreground">
                    Credit edits happen instantly on staging. Admin accounts always retain unlimited
                    access even if a numeric balance is set.
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-[20px] border border-dashed border-[#d9d0c2] bg-background/70 p-6 text-center">
                <div>
                  <p className="text-[15px] font-medium text-[#332e24]">Select a user</p>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    Pick a row to inspect account details and adjust credits.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </section>
      </main>

      <Dialog
        open={!!creditDialogUser}
        onOpenChange={(open) => {
          if (!open) {
            setCreditDialogUser(null);
            setCreditAmount("");
          }
        }}
      >
        <DialogContent className="border-[#dfd8cc] bg-[#fbf7ef]">
          <DialogHeader>
            <DialogTitle className="text-[22px] font-black tracking-[-0.7px] text-[#332e24]">
              Adjust credits
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="rounded-[18px] border border-[#e5dbc9] bg-background/90 p-4">
              <p className="text-[13px] font-medium text-[#332e24]">{creditDialogUser?.email}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Current balance:{" "}
                <span className="font-semibold text-foreground">
                  {creditDialogUser?.isAdmin ? "∞" : creditDialogUser?.credits}
                </span>
              </p>
            </div>

            <Input
              type="number"
              placeholder="Credit amount"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="h-12 rounded-2xl border-[#d8d0c5] bg-background"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="h-11 rounded-2xl"
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
                className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
                onClick={() => handleCredits("set")}
                disabled={!creditAmount || creditsMutation.isPending}
              >
                Set Balance
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
