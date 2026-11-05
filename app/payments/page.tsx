"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type PaymentType = "dues" | "penalty";
type PaymentMethod = "cashapp" | "zelle" | "paypal";

type Payment = {
    id: number;
    payment_type: PaymentType;
    amount: number;
    payment_method: string | null;
    status: "pending" | "paid" | "rejected";
    submitted_at: string;
};

export default function PaymentsPage() {
    const router = useRouter();

    const [participantId, setParticipantId] = useState<number | null>(null);
    const [participantName, setParticipantName] = useState("");
    const [totalPenalties, setTotalPenalties] = useState(0);

    const [payments, setPayments] = useState<Payment[]>([]);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const [selectedType, setSelectedType] =
        useState<PaymentType | null>(null);

    const [selectedMethod, setSelectedMethod] =
        useState<PaymentMethod | null>(null);

    const participationFee = Number(
        process.env.NEXT_PUBLIC_PARTICIPATION_FEE ?? 150
    );

    const cashAppTag =
        process.env.NEXT_PUBLIC_CASHAPP_TAG ?? "";

    const zelleName =
        process.env.NEXT_PUBLIC_ZELLE_NAME ?? "";

    const zelleContact =
        process.env.NEXT_PUBLIC_ZELLE_CONTACT ?? "";

    const paypalLink =
        process.env.NEXT_PUBLIC_PAYPAL_LINK ?? "";

    async function loadPayments() {
        setLoading(true);
        setError("");

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            router.push("/login");
            return;
        }

        const {
            data: participant,
            error: participantError,
        } = await supabase
            .from("participants")
            .select("id, name")
            .eq("auth_user_id", user.id)
            .single();

        if (participantError || !participant) {
            setError("Participant account could not be found.");
            setLoading(false);
            return;
        }

        setParticipantId(participant.id);
        setParticipantName(participant.name);

        const [
            paymentsResult,
            standingsResult,
        ] = await Promise.all([
            supabase
                .from("participant_payments")
                .select(
                    "id, payment_type, amount, payment_method, status, submitted_at"
                )
                .eq("participant_id", participant.id)
                .order("submitted_at", {
                    ascending: false,
                }),

            supabase
                .from("standings")
                .select("total_penalties")
                .eq("participant_id", participant.id)
                .maybeSingle(),
        ]);

        if (paymentsResult.error) {
            setError(paymentsResult.error.message);
            setLoading(false);
            return;
        }

        setPayments(
            (paymentsResult.data ?? []).map((payment) => ({
                ...payment,
                amount: Number(payment.amount),
            }))
        );

        setTotalPenalties(
            Number(
                standingsResult.data?.total_penalties ?? 0
            )
        );

        setLoading(false);
    }

    useEffect(() => {
        loadPayments();
    }, []);

    const totals = useMemo(() => {
        const duesPaid = payments
            .filter(
                (payment) =>
                    payment.payment_type === "dues" &&
                    payment.status === "paid"
            )
            .reduce(
                (sum, payment) => sum + Number(payment.amount),
                0
            );

        const penaltiesPaid = payments
            .filter(
                (payment) =>
                    payment.payment_type === "penalty" &&
                    payment.status === "paid"
            )
            .reduce(
                (sum, payment) => sum + Number(payment.amount),
                0
            );

        const duesPending = payments
            .filter(
                (payment) =>
                    payment.payment_type === "dues" &&
                    payment.status === "pending"
            )
            .reduce(
                (sum, payment) => sum + Number(payment.amount),
                0
            );

        const penaltiesPending = payments
            .filter(
                (payment) =>
                    payment.payment_type === "penalty" &&
                    payment.status === "pending"
            )
            .reduce(
                (sum, payment) => sum + Number(payment.amount),
                0
            );

        return {
            duesPaid,
            penaltiesPaid,
            duesPending,
            penaltiesPending,

            duesBalance: Math.max(
                participationFee - duesPaid,
                0
            ),

            penaltyBalance: Math.max(
                totalPenalties - penaltiesPaid,
                0
            ),
        };
    }, [
        payments,
        participationFee,
        totalPenalties,
    ]);

    function money(amount: number) {
        return amount.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
        });
    }

    function getPaymentAmount(type: PaymentType) {
        if (type === "dues") {
            return totals.duesBalance;
        }

        return totals.penaltyBalance;
    }

    async function choosePaymentMethod(
        type: PaymentType,
        method: PaymentMethod
    ) {
        const amount = getPaymentAmount(type);

        if (amount <= 0) {
            return;
        }

        setSelectedType(type);
        setSelectedMethod(method);
        setMessage("");
        setError("");

        if (method === "cashapp") {
            if (!cashAppTag) {
                setError(
                    "Cash App payment information is not configured."
                );
                return;
            }

            window.open(
                `https://cash.app/${cashAppTag}`,
                "_blank"
            );
        }

        if (method === "paypal") {
            if (!paypalLink) {
                setError(
                    "PayPal payment information is not configured."
                );
                return;
            }

            const cleanLink =
                paypalLink.endsWith("/")
                    ? paypalLink.slice(0, -1)
                    : paypalLink;

            window.open(
                `${cleanLink}/${amount.toFixed(2)}`,
                "_blank"
            );
        }

        if (method === "zelle") {
            if (!zelleContact) {
                setError(
                    "Zelle payment information is not configured."
                );
                return;
            }

            try {
                await navigator.clipboard.writeText(
                    zelleContact
                );

                setMessage(
                    `Zelle contact copied: ${zelleContact}`
                );
            } catch {
                setMessage(
                    `Send your Zelle payment to ${zelleContact}`
                );
            }
        }
    }

    async function submitPayment() {
        if (
            !participantId ||
            !selectedType ||
            !selectedMethod
        ) {
            return;
        }

        const amount =
            getPaymentAmount(selectedType);

        if (amount <= 0) {
            return;
        }

        const alreadyPending = payments.some(
            (payment) =>
                payment.payment_type === selectedType &&
                payment.status === "pending"
        );

        if (alreadyPending) {
            setError(
                "You already have a payment waiting for commissioner verification."
            );
            return;
        }

        const confirmed = window.confirm(
            `Confirm that you sent ${money(amount)} by ${selectedMethod.toUpperCase()}?`
        );

        if (!confirmed) {
            return;
        }

        setSubmitting(true);
        setError("");
        setMessage("");

        const { error: insertError } =
            await supabase
                .from("participant_payments")
                .insert({
                    participant_id: participantId,
                    payment_type: selectedType,
                    amount,
                    payment_method: selectedMethod,
                    status: "pending",
                });

        if (insertError) {
            setError(insertError.message);
            setSubmitting(false);
            return;
        }

        setMessage(
            "Payment submitted. Waiting for commissioner verification."
        );

        setSelectedType(null);
        setSelectedMethod(null);

        await loadPayments();

        setSubmitting(false);
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-zinc-950 text-white">
                <AppHeader />

                <div className="mx-auto max-w-3xl px-4 py-10">
                    <p className="text-zinc-400">
                        Loading payments...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-zinc-950 text-white">
            <AppHeader />

            <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
                <div>
                    <h1 className="text-3xl font-black">
                        My Payments
                    </h1>

                    <p className="mt-1 text-sm text-zinc-400">
                        {participantName}
                    </p>
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
                        {message}
                    </div>
                )}

                <PaymentCard
                    title="Participation Dues"
                    assessed={participationFee}
                    paid={totals.duesPaid}
                    pending={totals.duesPending}
                    balance={totals.duesBalance}
                    type="dues"
                    selectedType={selectedType}
                    selectedMethod={selectedMethod}
                    onSelect={choosePaymentMethod}
                    money={money}
                    zelleName={zelleName}
                    zelleContact={zelleContact}
                />

                <PaymentCard
                    title="Penalty Balance"
                    assessed={totalPenalties}
                    paid={totals.penaltiesPaid}
                    pending={totals.penaltiesPending}
                    balance={totals.penaltyBalance}
                    type="penalty"
                    selectedType={selectedType}
                    selectedMethod={selectedMethod}
                    onSelect={choosePaymentMethod}
                    money={money}
                    zelleName={zelleName}
                    zelleContact={zelleContact}
                />

                {selectedType && selectedMethod && (
                    <div className="rounded-2xl border border-emerald-700 bg-emerald-950/20 p-5">
                        <p className="text-sm text-zinc-400">
                            Payment confirmation
                        </p>

                        <p className="mt-1 text-xl font-black">
                            {selectedType === "dues"
                                ? "Participation Dues"
                                : "Penalty Payment"}
                        </p>

                        <p className="mt-3 text-3xl font-black text-emerald-400">
                            {money(
                                getPaymentAmount(
                                    selectedType
                                )
                            )}
                        </p>

                        <p className="mt-2 text-sm text-zinc-400">
                            Method:{" "}
                            {selectedMethod.toUpperCase()}
                        </p>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={submitPayment}
                            className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black disabled:opacity-50"
                        >
                            {submitting
                                ? "Submitting..."
                                : `I Paid ${money(
                                    getPaymentAmount(
                                        selectedType
                                    )
                                )}`}
                        </button>
                    </div>
                )}

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                    <h2 className="text-lg font-bold">
                        Payment History
                    </h2>

                    {payments.length === 0 ? (
                        <p className="mt-3 text-sm text-zinc-500">
                            No payments submitted yet.
                        </p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {payments.map((payment) => (
                                <div
                                    key={payment.id}
                                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                                >
                                    <div>
                                        <p className="font-bold capitalize">
                                            {payment.payment_type}
                                        </p>

                                        <p className="text-xs text-zinc-500">
                                            {payment.payment_method ??
                                                "Unknown method"}
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <p className="font-bold">
                                            {money(
                                                payment.amount
                                            )}
                                        </p>

                                        <p
                                            className={`text-xs font-bold uppercase ${payment.status ===
                                                    "paid"
                                                    ? "text-emerald-400"
                                                    : payment.status ===
                                                        "rejected"
                                                        ? "text-red-400"
                                                        : "text-yellow-400"
                                                }`}
                                        >
                                            {payment.status}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
                <div className="mx-auto grid max-w-md grid-cols-4">
                    <Link
                        href="/"
                        className="py-4 text-center text-xs font-bold text-zinc-500"
                    >
                        Draft
                    </Link>

                    <Link
                        href="/board"
                        className="py-4 text-center text-xs font-bold text-emerald-400"
                    >
                        Board
                    </Link>

                    <Link
                        href="/standings"
                        className="py-4 text-center text-xs font-bold text-zinc-500"
                    >
                        Standings
                    </Link>

                    <Link
                        href="/my-pick"
                        className="py-4 text-center text-xs font-bold text-zinc-500"
                    >
                        My Pick
                    </Link>
                </div>
            </nav>
        </main>
    );
}

function PaymentCard({
    title,
    assessed,
    paid,
    pending,
    balance,
    type,
    selectedType,
    selectedMethod,
    onSelect,
    money,
    zelleName,
    zelleContact,
}: {
    title: string;
    assessed: number;
    paid: number;
    pending: number;
    balance: number;
    type: PaymentType;
    selectedType: PaymentType | null;
    selectedMethod: PaymentMethod | null;
    onSelect: (
        type: PaymentType,
        method: PaymentMethod
    ) => void;
    money: (amount: number) => string;
    zelleName: string;
    zelleContact: string;
}) {
    const paidInFull = balance <= 0;

    return (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm text-zinc-400">
                        {title}
                    </p>

                    <p className="mt-1 text-3xl font-black">
                        {money(balance)}
                    </p>

                    <p className="text-xs text-zinc-500">
                        Amount due
                    </p>
                </div>

                <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${paidInFull
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                >
                    {paidInFull ? "PAID" : "DUE"}
                </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-zinc-950 p-3">
                    <p className="text-zinc-500">
                        Assessed
                    </p>

                    <p className="mt-1 font-bold">
                        {money(assessed)}
                    </p>
                </div>

                <div className="rounded-xl bg-zinc-950 p-3">
                    <p className="text-zinc-500">
                        Verified
                    </p>

                    <p className="mt-1 font-bold text-emerald-400">
                        {money(paid)}
                    </p>
                </div>

                <div className="rounded-xl bg-zinc-950 p-3">
                    <p className="text-zinc-500">
                        Pending
                    </p>

                    <p className="mt-1 font-bold text-yellow-400">
                        {money(pending)}
                    </p>
                </div>
            </div>

            {!paidInFull && (
                <>
                    <p className="mt-5 text-sm font-bold">
                        Choose payment method
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <button
                            type="button"
                            onClick={() =>
                                onSelect(
                                    type,
                                    "cashapp"
                                )
                            }
                            className={`rounded-xl border px-4 py-3 font-bold ${selectedType === type &&
                                    selectedMethod ===
                                    "cashapp"
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                    : "border-zinc-700 bg-zinc-950"
                                }`}
                        >
                            Cash App
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                onSelect(type, "zelle")
                            }
                            className={`rounded-xl border px-4 py-3 font-bold ${selectedType === type &&
                                    selectedMethod ===
                                    "zelle"
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                    : "border-zinc-700 bg-zinc-950"
                                }`}
                        >
                            Zelle
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                onSelect(
                                    type,
                                    "paypal"
                                )
                            }
                            className={`rounded-xl border px-4 py-3 font-bold ${selectedType === type &&
                                    selectedMethod ===
                                    "paypal"
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                    : "border-zinc-700 bg-zinc-950"
                                }`}
                        >
                            PayPal
                        </button>
                    </div>

                    {zelleContact && (
                        <p className="mt-3 text-xs text-zinc-500">
                            Zelle:{" "}
                            {zelleName
                                ? `${zelleName} - `
                                : ""}
                            {zelleContact}
                        </p>
                    )}
                </>
            )}
        </section>
    );
}