import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    dec,
    resolvePrimaryOrg,
    toIso,
    toWireInvoiceStatus,
} from "../portal.policy";
import type {
    ContractStatusWire,
    ICustomerBilling,
    IContractSummary,
    IInvoiceDetail,
    IInvoiceSummary,
    IPaymentMethod,
    IUpcomingCharge,
} from "./billing.type";
import type { PayInvoiceBody } from "./billing.validation";

const mapContractStatus = (raw: string): ContractStatusWire => {
    switch (raw) {
        case "SIGNED":
            return "signed";
        case "EXPIRED":
            return "expired";
        case "CANCELLED":
        case "VOIDED":
            return "expired";
        case "PENDING":
        case "APPROVED":
        case "CHANGES_REQUESTED":
        default:
            return "active";
    }
};

const getBilling = async (userId: string): Promise<ICustomerBilling> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        return {
            nextCharge: null,
            outstandingTotal: 0,
            ytdPaid: 0,
            paymentMethods: [],
            invoices: [],
            contracts: [],
        };
    }

    const [invoices, contracts, billingProfile] = await Promise.all([
        prisma.invoice.findMany({
            where: { organizationId: org.id },
            orderBy: { dueAt: "desc" },
            take: 50,
        }),
        prisma.contract.findMany({
            where: { organizationId: org.id },
            orderBy: { createdAt: "desc" },
        }),
        prisma.billingProfile.findUnique({
            where: { organizationId: org.id },
            select: {
                paymentProvider: true,
                paymentMethodMasked: true,
            },
        }),
    ]);

    const invoiceWires: IInvoiceSummary[] = invoices.map((inv) => ({
        id: inv.id,
        number: inv.invoiceNumber,
        status: toWireInvoiceStatus(inv.status),
        issuedAt: inv.createdAt.toISOString(),
        dueAt: inv.dueAt.toISOString(),
        paidAt: toIso(inv.paidAt),
        total: dec(inv.total),
        currency: inv.currency,
        pdfUrl: inv.storageKey,
        projectName: null,
    }));

    const contractWires: IContractSummary[] = contracts.map((c) => ({
        id: c.id,
        title: c.title,
        status: mapContractStatus(c.status),
        signedAt: toIso(c.signedAt),
        effectiveAt: null,
        expiresAt: null,
        pdfUrl: c.storageKey,
    }));

    const paymentMethodWires: IPaymentMethod[] = billingProfile?.paymentMethodMasked
        ? [
              {
                  id: `${org.id}-default`,
                  brand: billingProfile.paymentProvider ?? "card",
                  last4: billingProfile.paymentMethodMasked.slice(-4),
                  expiryMonth: null,
                  expiryYear: null,
                  isDefault: true,
              },
          ]
        : [];

    const outstanding = invoiceWires
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((acc, i) => acc + i.total, 0);

    const ytdPaid = invoiceWires
        .filter((i) => i.status === "paid")
        .reduce((acc, i) => acc + i.total, 0);

    const nextDue = invoiceWires
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];

    const nextCharge: IUpcomingCharge | null = nextDue
        ? {
              description: `Invoice ${nextDue.number}`,
              amount: nextDue.total,
              dueAt: nextDue.dueAt,
              invoiceId: nextDue.id,
          }
        : null;

    return {
        nextCharge,
        outstandingTotal: outstanding,
        ytdPaid: ytdPaid,
        paymentMethods: paymentMethodWires,
        invoices: invoiceWires,
        contracts: contractWires,
    };
};

const getInvoiceDetail = async (
    userId: string,
    invoiceId: string,
): Promise<IInvoiceDetail> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(status.FORBIDDEN, "No organization.", {
            code: "NO_ORG",
        });
    }

    const inv = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId: org.id },
        include: {
            items: { orderBy: { orderIndex: "asc" } },
            payments: {
                orderBy: { createdAt: "desc" },
            },
        },
    });
    if (!inv) {
        throw new AppError(status.NOT_FOUND, "Invoice not found.", {
            code: "INVOICE_NOT_FOUND",
        });
    }

    return {
        id: inv.id,
        number: inv.invoiceNumber,
        status: toWireInvoiceStatus(inv.status),
        issuedAt: inv.createdAt.toISOString(),
        dueAt: inv.dueAt.toISOString(),
        paidAt: toIso(inv.paidAt),
        total: dec(inv.total),
        currency: inv.currency,
        pdfUrl: inv.storageKey,
        projectName: null,
        subtotal: dec(inv.subtotal),
        tax: dec(inv.tax),
        notes: null,
        lines: inv.items.map((line) => ({
            id: line.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: dec(line.unitPrice),
            total: dec(line.amount),
        })),
        payments: inv.payments.map((p) => ({
            id: p.id,
            amount: dec(p.amount),
            status: p.status,
            provider: p.provider,
            createdAt: p.createdAt.toISOString(),
        })),
    };
};

const getContractPdf = async (userId: string, contractId: string) => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(status.FORBIDDEN, "No organization.", {
            code: "NO_ORG",
        });
    }
    const contract = await prisma.contract.findFirst({
        where: { id: contractId, organizationId: org.id },
    });
    if (!contract) {
        throw new AppError(status.NOT_FOUND, "Contract not found.", {
            code: "CONTRACT_NOT_FOUND",
        });
    }
    if (!contract.storageKey) {
        throw new AppError(
            status.NOT_FOUND,
            "Contract PDF unavailable.",
            { code: "PDF_MISSING" },
        );
    }
    return { url: contract.storageKey, filename: `${contract.title}.pdf` };
};

const getInvoicePdf = async (userId: string, invoiceId: string) => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(status.FORBIDDEN, "No organization.", {
            code: "NO_ORG",
        });
    }
    const inv = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId: org.id },
    });
    if (!inv) {
        throw new AppError(status.NOT_FOUND, "Invoice not found.", {
            code: "INVOICE_NOT_FOUND",
        });
    }
    if (!inv.storageKey) {
        throw new AppError(
            status.NOT_FOUND,
            "Invoice PDF unavailable.",
            { code: "PDF_MISSING" },
        );
    }
    return { url: inv.storageKey, filename: `Invoice-${inv.invoiceNumber}.pdf` };
};

const payInvoice = async (
    userId: string,
    invoiceId: string,
    body: PayInvoiceBody,
) => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(status.FORBIDDEN, "No organization.", {
            code: "NO_ORG",
        });
    }

    const idempotencyKey =
        body.idempotencyKey ?? `pay-${invoiceId}-${Date.now()}`;

    const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey },
        select: {
            id: true,
            status: true,
            amount: true,
            createdAt: true,
        },
    });
    if (existingPayment) {
        return {
            id: existingPayment.id,
            status: existingPayment.status,
            invoiceId,
            amount: dec(existingPayment.amount),
            processedAt: existingPayment.createdAt.toISOString(),
            idempotent: true,
        };
    }

    const inv = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId: org.id },
    });
    if (!inv) {
        throw new AppError(status.NOT_FOUND, "Invoice not found.", {
            code: "INVOICE_NOT_FOUND",
        });
    }
    if (inv.status === "PAID") {
        throw new AppError(
            status.CONFLICT,
            "Invoice already paid.",
            { code: "ALREADY_PAID" },
        );
    }

    if (!body.paymentMethodId) {
        throw new AppError(
            status.BAD_REQUEST,
            "paymentMethodId is required.",
            { code: "PAYMENT_METHOD_REQUIRED" },
        );
    }

    const payment = await prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
            data: {
                invoiceId,
                idempotencyKey,
                amount: inv.balance,
                currency: inv.currency,
                status: "SUCCEEDED",
                provider: "stripe",
                providerRef: null,
            },
        });
        await tx.paymentAttempt.create({
            data: {
                paymentId: created.id,
                status: "SUCCEEDED",
            },
        });
        await tx.invoice.update({
            where: { id: invoiceId },
            data: {
                status: "PAID",
                paidAt: new Date(),
                balance: 0,
            },
        });
        return created;
    });

    return {
        id: payment.id,
        status: payment.status,
        invoiceId,
        amount: dec(payment.amount),
        processedAt: payment.createdAt.toISOString(),
        idempotent: false,
    };
};

export const billingService = {
    getBilling,
    getInvoiceDetail,
    getContractPdf,
    getInvoicePdf,
    payInvoice,
};