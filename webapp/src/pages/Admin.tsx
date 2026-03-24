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
import { toast } from "@/components/ui/sonner";
import {
  CreditCard,
  ExternalLink,
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
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  plan: string;
  conversionCount: number;
}

interface PromoCode {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  duration: string | null;
  durationInMonths: number | null;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
}

interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  defaultPriceId: string | null;
  createdAt: string | null;
}

interface BillingPrice {
  id: string;
  productId: string | null;
  productName: string | null;
  active: boolean;
  unitAmount: number | null;
  currency: string;
  type: "recurring" | "one_time";
  interval: string | null;
  nickname: string | null;
  creditsAmount: number | null;
}

interface BillingOverview {
  stripeEnabled: boolean;
  liveMode: boolean;
  activeConfig: {
    activeProPriceId: string | null;
    activeCreditsPackPriceId: string | null;
    activeCreditsPackAmount: number;
  };
  recentPromotionCodes: PromoCode[];
  products: BillingProduct[];
  prices: BillingPrice[];
}

interface UserBillingDetails {
  customerId: string | null;
  portalAvailable: boolean;
  subscriptions: Array<{
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    priceId: string | null;
  }>;
  charges: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    paid: boolean;
    refunded: boolean;
    amountRefunded: number;
    createdAt: string;
    receiptUrl: string | null;
  }>;
}

type FilterId = "all" | "admins" | "pro" | "low-credits";
type PromoDuration = "once" | "forever" | "repeating";
type PriceMode = "recurring" | "one_time";

const filters: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All Users" },
  { id: "admins", label: "Admins" },
  { id: "pro", label: "Pro" },
  { id: "low-credits", label: "Low Credits" },
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeJoinDate(iso: string) {
  const date = new Date(iso);
  return `Joined ${date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })}`;
}

function formatMoney(amount: number | null, currency: string) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatPromoDuration(duration: string | null, durationInMonths: number | null) {
  if (duration === "repeating" && durationInMonths) {
    return `${durationInMonths} months`;
  }
  if (!duration) return "—";
  return duration.charAt(0).toUpperCase() + duration.slice(1);
}

function formatMutationError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
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
  icon: any;
  label: string;
  value: string | number;
  meta: string;
}) {
  return (
    <div className="border border-[#e7e0d5] bg-[#fbfaf7] p-5">
      <div className="flex items-start justify-between gap-4 border-b border-[#ece6db] pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-[#8a8378]">
            {label}
          </p>
          <p className="mt-4 text-[34px] font-semibold leading-none tracking-[-0.08em] text-[#26231f]">
            {value}
          </p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-[#fffdf9] text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-[12px] leading-5 text-[#6f695f]">{meta}</p>
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

  const [promoCode, setPromoCode] = useState("");
  const [promoPercentOff, setPromoPercentOff] = useState("15");
  const [promoDuration, setPromoDuration] = useState<PromoDuration>("once");
  const [promoDurationMonths, setPromoDurationMonths] = useState("3");
  const [promoMaxRedemptions, setPromoMaxRedemptions] = useState("");

  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");

  const [priceProductId, setPriceProductId] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("eur");
  const [priceMode, setPriceMode] = useState<PriceMode>("recurring");
  const [priceInterval, setPriceInterval] = useState("month");
  const [priceNickname, setPriceNickname] = useState("");
  const [priceCreditsAmount, setPriceCreditsAmount] = useState("");

  const [configProPriceId, setConfigProPriceId] = useState("");
  const [configCreditsPriceId, setConfigCreditsPriceId] = useState("");
  const [configCreditsAmount, setConfigCreditsAmount] = useState("10");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
  });

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<AdminUser[]>("/api/admin/users"),
  });

  const { data: billing, isLoading: billingLoading, refetch: refetchBilling } = useQuery({
    queryKey: ["admin", "billing"],
    queryFn: () => api.get<BillingOverview>("/api/admin/billing"),
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

  const { data: selectedUserBilling, isLoading: selectedUserBillingLoading } = useQuery({
    queryKey: ["admin", "billing", "user", selectedUser?.id],
    queryFn: () => api.get<UserBillingDetails>(`/api/admin/billing/users/${selectedUser!.id}`),
    enabled: !!selectedUser?.id,
  });

  useEffect(() => {
    if (!billing) return;
    setConfigProPriceId(billing.activeConfig.activeProPriceId ?? "");
    setConfigCreditsPriceId(billing.activeConfig.activeCreditsPackPriceId ?? "");
    setConfigCreditsAmount(String(billing.activeConfig.activeCreditsPackAmount ?? 10));
  }, [billing]);

  const billingProducts = [...(billing?.products ?? [])].sort((a, b) => {
    if (a.active !== b.active) return Number(b.active) - Number(a.active);
    return a.name.localeCompare(b.name);
  });
  const selectableProducts = billingProducts.filter((product) => product.active);
  const billingPrices = [...(billing?.prices ?? [])].sort((a, b) => {
    if (a.active !== b.active) return Number(b.active) - Number(a.active);
    return (a.productName ?? a.nickname ?? a.id).localeCompare(
      b.productName ?? b.nickname ?? b.id
    );
  });
  const billingPromotions = [...(billing?.recentPromotionCodes ?? [])].sort((a, b) => {
    if (a.active !== b.active) return Number(b.active) - Number(a.active);
    return a.code.localeCompare(b.code);
  });

  useEffect(() => {
    if (!priceProductId && selectableProducts.length) {
      setPriceProductId(selectableProducts[0].id);
    }
  }, [selectableProducts, priceProductId]);

  useEffect(() => {
    if (priceProductId && !selectableProducts.some((product) => product.id === priceProductId)) {
      setPriceProductId(selectableProducts[0]?.id ?? "");
    }
  }, [selectableProducts, priceProductId]);

  const recurringPrices =
    billingPrices.filter((price) => price.active && price.type === "recurring");
  const oneTimePrices =
    billingPrices.filter((price) => price.active && price.type === "one_time");

  const lowCreditCount = allUsers.filter((user) => !user.isAdmin && user.credits <= 3).length;
  const adminCount = allUsers.filter((user) => user.isAdmin).length;

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
      toast.success("Credits updated");
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
    },
  });

  const productMutation = useMutation({
    mutationFn: () =>
      api.post<BillingProduct>("/api/admin/billing/products", {
        name: productName.trim(),
        description: productDescription.trim() || undefined,
      }),
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "billing"] });
      setProductName("");
      setProductDescription("");
      setPriceProductId(product.id);
      toast.success(`Created product ${product.name}`);
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
    },
  });

  const priceMutation = useMutation({
    mutationFn: () =>
      api.post<BillingPrice>("/api/admin/billing/prices", {
        productId: priceProductId,
        amount: Number(priceAmount),
        currency: priceCurrency,
        mode: priceMode,
        interval: priceMode === "recurring" ? priceInterval : undefined,
        nickname: priceNickname.trim() || undefined,
        creditsAmount:
          priceMode === "one_time" && priceCreditsAmount
            ? Number(priceCreditsAmount)
            : undefined,
      }),
    onSuccess: async (price) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "billing"] });
      setPriceAmount("");
      setPriceNickname("");
      setPriceCreditsAmount("");
      toast.success(`Created price ${price.id}`);
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
    },
  });

  const configMutation = useMutation({
    mutationFn: () =>
      api.post("/api/admin/billing/config", {
        activeProPriceId: configProPriceId || null,
        activeCreditsPackPriceId: configCreditsPriceId || null,
        activeCreditsPackAmount: Number(configCreditsAmount),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "billing"] }),
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
      ]);
      toast.success("Billing config saved");
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
    },
  });

  const promoCodeMutation = useMutation({
    mutationFn: () =>
      api.post<PromoCode>("/api/admin/billing/promo-codes", {
        code: promoCode.trim().toUpperCase(),
        percentOff: Number(promoPercentOff),
        duration: promoDuration,
        durationInMonths:
          promoDuration === "repeating" ? Number(promoDurationMonths) : undefined,
        maxRedemptions: promoMaxRedemptions
          ? Number(promoMaxRedemptions)
          : undefined,
      }),
    onSuccess: async (promo) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "billing"] });
      setPromoCode("");
      setPromoPercentOff("15");
      setPromoDuration("once");
      setPromoDurationMonths("3");
      setPromoMaxRedemptions("");
      toast.success(`Promo code ${promo.code} created`);
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
    },
  });

  const deactivatePromoMutation = useMutation({
    mutationFn: (promoId: string) =>
      api.post<PromoCode>(`/api/admin/billing/promo-codes/${promoId}/deactivate`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "billing"] });
      toast.success("Promo code deactivated");
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
    },
  });

  const archiveProductMutation = useMutation({
    mutationFn: (productId: string) =>
      api.post<BillingProduct>(`/api/admin/billing/products/${productId}/archive`, {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "billing"] }),
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
      ]);
      toast.success("Product archived");
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
    },
  });

  const archivePriceMutation = useMutation({
    mutationFn: (priceId: string) =>
      api.post<BillingPrice>(`/api/admin/billing/prices/${priceId}/archive`, {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "billing"] }),
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
      ]);
      toast.success("Price archived");
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
    },
  });

  const portalMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post<{ url: string }>(`/api/admin/billing/users/${userId}/portal`, {
        returnUrl: `${window.location.origin}/admin`,
      }),
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Opened Stripe billing portal");
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
    },
  });

  const refundMutation = useMutation({
    mutationFn: (params: { userId: string; chargeId: string }) =>
      api.post(`/api/admin/billing/users/${params.userId}/refunds`, {
        chargeId: params.chargeId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "billing", "user", selectedUser?.id],
      });
      toast.success("Refund created");
    },
    onError: (error) => {
      toast.error(formatMutationError(error));
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

  const canCreatePromoCode =
    promoCode.trim().length >= 3 &&
    Number(promoPercentOff) > 0 &&
    Number(promoPercentOff) <= 100 &&
    (promoDuration !== "repeating" || Number(promoDurationMonths) > 0);

  const canCreateProduct = productName.trim().length >= 2;
  const canCreatePrice =
    !!priceProductId &&
    Number(priceAmount) > 0 &&
    (priceMode !== "recurring" || !!priceInterval) &&
    (priceMode !== "one_time" || !priceCreditsAmount || Number(priceCreditsAmount) > 0);
  const canSaveConfig =
    Number(configCreditsAmount) > 0 &&
    (!!configProPriceId || !!configCreditsPriceId);

  const stripeUnavailableReason =
    "Stripe is not configured on this environment. Add STRIPE_SECRET in Coolify and redeploy.";

  const productActionHint = !billing?.stripeEnabled
    ? stripeUnavailableReason
    : !productName.trim()
      ? "Enter a product name to create a Stripe product."
      : "This will create a reusable Stripe product in your catalog.";

  const priceActionHint = !billing?.stripeEnabled
    ? stripeUnavailableReason
    : !priceProductId
      ? "Pick a Stripe product first."
      : Number(priceAmount) <= 0
        ? "Enter the price amount in the smallest currency unit, for example 900 for EUR 9.00."
        : priceMode === "one_time" && priceCreditsAmount && Number(priceCreditsAmount) <= 0
          ? "Credit-pack prices need a positive credit amount."
          : "Create the Stripe price here, then choose whether it should become the live app price.";

  const configActionHint = !billing?.stripeEnabled
    ? stripeUnavailableReason
    : !configProPriceId && !configCreditsPriceId
      ? "Select at least one active price to make the billing config usable."
      : Number(configCreditsAmount) <= 0
        ? "Credit pack amount must be greater than zero."
        : "Saving this updates the prices used by the account-page checkout buttons.";

  const promoActionHint = !billing?.stripeEnabled
    ? stripeUnavailableReason
    : !promoCode.trim()
      ? "Enter a code like SPRING20."
      : Number(promoPercentOff) <= 0 || Number(promoPercentOff) > 100
        ? "Discount percent must be between 1 and 100."
        : promoDuration === "repeating" && Number(promoDurationMonths) <= 0
          ? "Repeating promo codes need a duration in months."
          : "This code will be available immediately in Stripe Checkout.";

  const handleDeactivatePromo = (promo: PromoCode) => {
    if (
      !window.confirm(
        `Deactivate promo code ${promo.code}? It will stop working in future checkouts.`
      )
    ) {
      return;
    }
    deactivatePromoMutation.mutate(promo.id);
  };

  const handleArchiveProduct = (product: BillingProduct) => {
    if (
      !window.confirm(
        `Archive product ${product.name}? It will be removed from new billing configuration options.`
      )
    ) {
      return;
    }
    archiveProductMutation.mutate(product.id);
  };

  const handleArchivePrice = (price: BillingPrice) => {
    if (
      !window.confirm(
        `Archive price ${price.id}? It will stop being available for new checkout sessions.`
      )
    ) {
      return;
    }
    archivePriceMutation.mutate(price.id);
  };

  return (
    <div className="min-h-screen bg-[#f8f8f6] pt-[52px] text-[#302d29]">
      <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="border-b border-[#e7e0d5] pb-8">
          <div className="flex flex-col gap-6 px-1 py-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[720px]">
              <div className="mb-4 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#8a8378]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1f1f1f]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                Admin control
              </div>
              <h1
                className="max-w-[10ch] text-[40px] font-light uppercase leading-[0.92] tracking-[-0.05em] text-[#26231f] sm:text-[56px]"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Users, billing, and support in one workspace.
              </h1>
              <p className="mt-4 max-w-[62ch] text-[14px] leading-6 text-[#6f695f] sm:text-[15px]">
                Review accounts, manage credits, tune live Stripe pricing, and resolve billing issues
                without leaving Gravu.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 rounded-2xl border-[#d9d0c2] bg-background/80 px-5"
                onClick={() => {
                  refetchUsers();
                  refetchBilling();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </Button>
            </div>
          </div>
        </section>

        {statsLoading ? (
          <div className="flex h-28 items-center justify-center border border-[#e7e0d5] bg-[#fbfaf7]">
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

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_400px]">
          <div className="overflow-hidden border border-[#e7e0d5] bg-[#fbfaf7]">
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
                          : "border-[#d9d0c2] bg-[#fffdf9] text-[#6f695f] hover:bg-[#f4ede4]"
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
                        isSelected ? "bg-[#f6efe5]" : "hover:bg-[#f8f3ea]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#eadfce] bg-[#fffdf9] text-[13px] font-bold text-[#332e24]">
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

          <aside className="border border-[#e7e0d5] bg-[#fbfaf7] p-5 sm:p-6 xl:sticky xl:top-[84px] xl:h-fit">
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

                <div className="mt-5 border border-[#e5dbc9] bg-[#fffdf9] p-4">
                  <p className="truncate text-[14px] font-medium text-[#332e24]">{selectedUser.email}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {formatRelativeJoinDate(selectedUser.createdAt)}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="border border-[#e5dbc9] bg-[#fffdf9] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Credits
                    </p>
                    <p className="mt-2 text-[28px] font-black leading-none tracking-[-1px] text-[#332e24]">
                      {selectedUser.isAdmin ? "∞" : selectedUser.credits}
                    </p>
                  </div>
                  <div className="border border-[#e5dbc9] bg-[#fffdf9] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Conversions
                    </p>
                    <p className="mt-2 text-[28px] font-black leading-none tracking-[-1px] text-[#332e24]">
                      {selectedUser.conversionCount}
                    </p>
                  </div>
                  <div className="border border-[#e5dbc9] bg-[#fffdf9] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Joined
                    </p>
                    <p className="mt-2 text-[16px] font-semibold text-[#332e24]">
                      {formatDate(selectedUser.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border border-[#e5dbc9] bg-[#fffdf9] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                    Stripe
                  </p>
                  <div className="mt-3 space-y-2 text-[12px] text-[#6f695f]">
                    <div className="flex items-center justify-between gap-3">
                      <span>Status</span>
                      <span className="font-medium text-[#332e24]">
                        {selectedUser.subscriptionStatus ?? "No subscription"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Customer</span>
                      <span className="truncate font-medium text-[#332e24]">
                        {selectedUser.stripeCustomerId ?? "Not created"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Period End</span>
                      <span className="font-medium text-[#332e24]">
                        {formatDate(selectedUser.currentPeriodEnd)}
                      </span>
                    </div>
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

                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl border-[#d8d0c5] bg-background"
                    disabled={!selectedUser.stripeCustomerId || portalMutation.isPending}
                    onClick={() => portalMutation.mutate(selectedUser.id)}
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Open Billing Portal
                  </Button>
                </div>

                <div className="mt-5 border border-[#e5dbc9] bg-[#fffdf9] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Recent Charges
                    </p>
                    {selectedUserBillingLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-3">
                    {selectedUserBilling?.charges.length ? (
                      selectedUserBilling.charges.slice(0, 4).map((charge) => (
                        <div
                          key={charge.id}
                          className="border border-[#ece5d8] bg-[#fcfaf6] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[13px] font-semibold text-[#332e24]">
                                {formatMoney(charge.amount, charge.currency)}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {formatDate(charge.createdAt)} · {charge.status}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              className="h-8 rounded-xl border-[#d8d0c5] px-3 text-[11px]"
                              disabled={
                                charge.refunded ||
                                refundMutation.isPending ||
                                !charge.paid
                              }
                              onClick={() =>
                                refundMutation.mutate({
                                  userId: selectedUser.id,
                                  chargeId: charge.id,
                                })
                              }
                            >
                              Refund
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#6f695f]">
                            <span>{charge.refunded ? "Refunded" : "Paid"}</span>
                            <span>
                              Amount refunded: {formatMoney(charge.amountRefunded, charge.currency)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-[#d9d0c2] px-4 py-4 text-[12px] text-muted-foreground">
                        No Stripe charges for this user yet.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center border border-dashed border-[#d9d0c2] bg-[#fffdf9] p-6 text-center">
                <div>
                  <p className="text-[15px] font-medium text-[#332e24]">Select a user</p>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    Pick a row to inspect account details, portal access, and refund actions.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="border border-[#e7e0d5] bg-[#fbfaf7] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                  Billing Config
                </p>
                <h2 className="mt-2 text-[26px] font-black tracking-[-0.9px] text-[#332e24]">
                  Live app pricing
                </h2>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold",
                  billing?.stripeEnabled
                    ? "border-[#edcbbd] bg-[#fcf2ee] text-[#c96240]"
                    : "border-[#d9d8d3] bg-background text-[#82817d]"
                )}
              >
                {billing?.stripeEnabled
                  ? billing?.liveMode
                    ? "Live Stripe"
                    : "Test Stripe"
                  : "Not Configured"}
              </span>
            </div>

            {billingLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {!billing?.stripeEnabled && (
                  <div className="rounded-[18px] border border-[#edcbbd] bg-[#fcf2ee] px-4 py-3 text-[12px] leading-5 text-[#a65436]">
                    Stripe is not configured on this environment. Add `STRIPE_SECRET` in Coolify,
                    save, and redeploy before using billing controls.
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Active Pro Price
                    </span>
                    <select
                      value={configProPriceId}
                      onChange={(e) => setConfigProPriceId(e.target.value)}
                      className="h-11 w-full rounded-2xl border border-[#d8d0c5] bg-background px-4 text-[13px] text-[#332e24]"
                    >
                      <option value="">No active Pro price</option>
                      {recurringPrices.map((price) => (
                        <option key={price.id} value={price.id}>
                          {(price.productName ?? price.nickname ?? price.id)} ·{" "}
                          {formatMoney(price.unitAmount, price.currency)}
                          {price.interval ? ` / ${price.interval}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                      Active Credit Pack Price
                    </span>
                    <select
                      value={configCreditsPriceId}
                      onChange={(e) => setConfigCreditsPriceId(e.target.value)}
                      className="h-11 w-full rounded-2xl border border-[#d8d0c5] bg-background px-4 text-[13px] text-[#332e24]"
                    >
                      <option value="">No active credit pack</option>
                      {oneTimePrices.map((price) => (
                        <option key={price.id} value={price.id}>
                          {(price.productName ?? price.nickname ?? price.id)} ·{" "}
                          {formatMoney(price.unitAmount, price.currency)}
                          {price.creditsAmount ? ` · ${price.creditsAmount} credits` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                    Active Credit Pack Amount
                  </span>
                  <Input
                    type="number"
                    value={configCreditsAmount}
                    onChange={(e) => setConfigCreditsAmount(e.target.value)}
                    className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
                  />
                </label>

                <Button
                  className="h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!billing?.stripeEnabled || !canSaveConfig || configMutation.isPending}
                  onClick={() => configMutation.mutate()}
                >
                  {configMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save App Billing Config
                </Button>

                <p
                  className={cn(
                    "text-[12px] leading-5",
                    !billing?.stripeEnabled || !canSaveConfig
                      ? "text-[#a65436]"
                      : "text-muted-foreground"
                  )}
                >
                  {configActionHint}
                </p>

                <div className="rounded-[18px] border border-dashed border-[#d9d0c2] px-4 py-3 text-[12px] leading-5 text-muted-foreground">
                  The account page checkout buttons use this config. If you create a new Stripe
                  price here, it only becomes customer-facing after you save it as active.
                </div>
              </div>
            )}
          </div>

          <div className="border border-[#e7e0d5] bg-[#fbfaf7] p-5 sm:p-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                Catalog Builder
              </p>
              <h2 className="mt-2 text-[26px] font-black tracking-[-0.9px] text-[#332e24]">
                Create products and prices
              </h2>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 border border-[#e5dbc9] bg-[#fffdf9] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                  New Product
                </p>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Gravu Pro"
                  className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
                />
                <Input
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Optional description"
                  className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
                />
                <Button
                  className="h-11 w-full rounded-2xl"
                  disabled={!billing?.stripeEnabled || !canCreateProduct || productMutation.isPending}
                  onClick={() => productMutation.mutate()}
                >
                  {productMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Create Product
                </Button>
                <p
                  className={cn(
                    "text-[12px] leading-5",
                    !billing?.stripeEnabled || !canCreateProduct
                      ? "text-[#a65436]"
                      : "text-muted-foreground"
                  )}
                >
                  {productActionHint}
                </p>
              </div>

              <div className="space-y-3 border border-[#e5dbc9] bg-[#fffdf9] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                  New Price
                </p>
                <select
                  value={priceProductId}
                  onChange={(e) => setPriceProductId(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-[#d8d0c5] bg-background px-4 text-[13px] text-[#332e24]"
                >
                  <option value="">Select product</option>
                  {selectableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="number"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    placeholder="900"
                    className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
                  />
                  <Input
                    value={priceCurrency}
                    onChange={(e) => setPriceCurrency(e.target.value)}
                    placeholder="eur"
                    className="h-11 rounded-2xl border-[#d8d0c5] bg-background uppercase"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["recurring", "one_time"] as PriceMode[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPriceMode(value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                        priceMode === value
                          ? "border-[#c96240] bg-[#fcf2ee] text-[#c96240]"
                          : "border-[#d9d0c2] bg-[#fffdf9] text-[#6f695f] hover:bg-[#f4ede4]"
                      )}
                    >
                      {value === "recurring" ? "Recurring" : "One-time"}
                    </button>
                  ))}
                </div>
                {priceMode === "recurring" ? (
                  <select
                    value={priceInterval}
                    onChange={(e) => setPriceInterval(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-[#d8d0c5] bg-background px-4 text-[13px] text-[#332e24]"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                    <option value="week">Weekly</option>
                    <option value="day">Daily</option>
                  </select>
                ) : (
                  <Input
                    type="number"
                    value={priceCreditsAmount}
                    onChange={(e) => setPriceCreditsAmount(e.target.value)}
                    placeholder="Credits granted, e.g. 10"
                    className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
                  />
                )}
                <Input
                  value={priceNickname}
                  onChange={(e) => setPriceNickname(e.target.value)}
                  placeholder="Optional nickname"
                  className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
                />
                <Button
                  className="h-11 w-full rounded-2xl"
                  disabled={!billing?.stripeEnabled || !canCreatePrice || priceMutation.isPending}
                  onClick={() => priceMutation.mutate()}
                >
                  {priceMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Create Price
                </Button>
                <p
                  className={cn(
                    "text-[12px] leading-5",
                    !billing?.stripeEnabled || !canCreatePrice
                      ? "text-[#a65436]"
                      : "text-muted-foreground"
                  )}
                >
                  {priceActionHint}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="border border-[#e7e0d5] bg-[#fbfaf7] p-5 sm:p-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                Promotions
              </p>
              <h2 className="mt-2 text-[26px] font-black tracking-[-0.9px] text-[#332e24]">
                Promo codes
              </h2>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="SPRING20"
                className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
              />
              <Input
                type="number"
                value={promoPercentOff}
                onChange={(e) => setPromoPercentOff(e.target.value)}
                placeholder="15"
                className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["once", "forever", "repeating"] as PromoDuration[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPromoDuration(value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                    promoDuration === value
                      ? "border-[#c96240] bg-[#fcf2ee] text-[#c96240]"
                      : "border-[#d9d0c2] bg-[#fffdf9] text-[#6f695f] hover:bg-[#f4ede4]"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {promoDuration === "repeating" ? (
                <Input
                  type="number"
                  value={promoDurationMonths}
                  onChange={(e) => setPromoDurationMonths(e.target.value)}
                  placeholder="3"
                  className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d9d0c2] px-4 py-3 text-[12px] text-muted-foreground">
                  Duration applies automatically for {promoDuration} discounts.
                </div>
              )}

              <Input
                type="number"
                value={promoMaxRedemptions}
                onChange={(e) => setPromoMaxRedemptions(e.target.value)}
                placeholder="Max redemptions (optional)"
                className="h-11 rounded-2xl border-[#d8d0c5] bg-background"
              />
            </div>

            <Button
              className="mt-4 h-11 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!billing?.stripeEnabled || !canCreatePromoCode || promoCodeMutation.isPending}
              onClick={() => promoCodeMutation.mutate()}
            >
              {promoCodeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Promo Code
            </Button>

            <p
              className={cn(
                "mt-3 text-[12px] leading-5",
                !billing?.stripeEnabled || !canCreatePromoCode
                  ? "text-[#a65436]"
                  : "text-muted-foreground"
              )}
            >
              {promoActionHint}
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#332e24]">Promotion codes</p>
                <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
                  {billingPromotions.length} codes
                </span>
              </div>

              <div className="space-y-3">
                {billingLoading ? (
                  <div className="flex h-24 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : billingPromotions.length ? (
                  billingPromotions.map((promo) => (
                    <div
                      key={promo.id}
                      className="rounded-[18px] border border-[#e5dbc9] bg-background/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-[#332e24]">{promo.code}</p>
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            {promo.percentOff ?? 0}% off ·{" "}
                            {formatPromoDuration(promo.duration, promo.durationInMonths)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                              promo.active
                                ? "border-[#edcbbd] bg-[#fcf2ee] text-[#c96240]"
                                : "border-[#d9d8d3] bg-background text-[#82817d]"
                            )}
                          >
                            {promo.active ? "Active" : "Inactive"}
                          </span>
                          {promo.active ? (
                            <Button
                              variant="outline"
                              className="h-8 rounded-xl border-[#d8d0c5] bg-background px-3 text-[11px]"
                              disabled={deactivatePromoMutation.isPending}
                              onClick={() => handleDeactivatePromo(promo)}
                            >
                              {deactivatePromoMutation.isPending ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              Deactivate
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#6f695f]">
                        <span>Redeemed: {promo.timesRedeemed}</span>
                        <span>Cap: {promo.maxRedemptions ?? "—"}</span>
                        <span>Expires: {promo.expiresAt ? formatDate(promo.expiresAt) : "No expiry"}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[#d9d0c2] px-4 py-5 text-[12px] text-muted-foreground">
                    No promo codes yet. Codes created here work immediately in Stripe Checkout.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border border-[#e7e0d5] bg-[#fbfaf7] p-5 sm:p-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                Stripe Catalog
              </p>
              <h2 className="mt-2 text-[26px] font-black tracking-[-0.9px] text-[#332e24]">
                Products and prices
              </h2>
            </div>

            <div className="mt-6 space-y-4">
              <div className="border border-[#e5dbc9] bg-[#fffdf9] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                  Catalog products
                </p>
                <div className="mt-3 space-y-3">
                  {billingProducts.length ? (
                    billingProducts.map((product) => (
                      <div key={product.id} className="border border-[#ece5d8] bg-[#fcfaf6] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-semibold text-[#332e24]">{product.name}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {product.description || "No description"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                                product.active
                                  ? "border-[#edcbbd] bg-[#fcf2ee] text-[#c96240]"
                                  : "border-[#d9d8d3] bg-background text-[#82817d]"
                              )}
                            >
                              {product.active ? "Active" : "Archived"}
                            </span>
                            {product.active ? (
                              <Button
                                variant="outline"
                                className="h-8 rounded-xl border-[#d8d0c5] bg-background px-3 text-[11px]"
                                disabled={archiveProductMutation.isPending}
                                onClick={() => handleArchiveProduct(product)}
                              >
                                {archiveProductMutation.isPending ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Archive
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                          {product.id}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[14px] border border-dashed border-[#d9d0c2] px-4 py-4 text-[12px] text-muted-foreground">
                      No Stripe products found.
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-[#e5dbc9] bg-[#fffdf9] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[1.8px] text-muted-foreground">
                  Catalog prices
                </p>
                <div className="mt-3 space-y-3">
                  {billingPrices.length ? (
                    billingPrices.map((price) => (
                      <div key={price.id} className="border border-[#ece5d8] bg-[#fcfaf6] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-semibold text-[#332e24]">
                              {price.productName ?? price.nickname ?? price.id}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {formatMoney(price.unitAmount, price.currency)}
                              {price.interval ? ` / ${price.interval}` : ""}
                              {price.creditsAmount ? ` · ${price.creditsAmount} credits` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-[#d9d0c2] bg-background px-2.5 py-1 text-[10px] font-semibold text-[#6f695f]">
                              {price.type === "recurring" ? "Recurring" : "One-time"}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                                price.active
                                  ? "border-[#edcbbd] bg-[#fcf2ee] text-[#c96240]"
                                  : "border-[#d9d8d3] bg-background text-[#82817d]"
                              )}
                            >
                              {price.active ? "Active" : "Archived"}
                            </span>
                            {price.active ? (
                              <Button
                                variant="outline"
                                className="h-8 rounded-xl border-[#d8d0c5] bg-background px-3 text-[11px]"
                                disabled={archivePriceMutation.isPending}
                                onClick={() => handleArchivePrice(price)}
                              >
                                {archivePriceMutation.isPending ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Archive
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                          {price.id}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[14px] border border-dashed border-[#d9d0c2] px-4 py-4 text-[12px] text-muted-foreground">
                      No Stripe prices found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
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
        <DialogContent className="border-[#e7e0d5] bg-[#fbfaf7]">
          <DialogHeader>
            <DialogTitle className="text-[22px] font-black tracking-[-0.7px] text-[#332e24]">
              Adjust credits
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="border border-[#e5dbc9] bg-[#fffdf9] p-4">
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
