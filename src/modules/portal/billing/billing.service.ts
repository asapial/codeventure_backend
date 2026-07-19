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
        case "EXPIRING":
            return "expiring";
        case "EXPIRED":
            return "expired";
        case "SIGNED":
            return "signed";
        default:
            return "active";
    }
};

const getBilling = async (userId: string): Promise<ICustomerBilling> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        return {
            nextCharge: null,
            outstandingTotal: "0.00",
            ytdPaid: "0.00",
            paymentMethods: [],
            invoices: [],
            contracts: [],
        };
    }

    const [invoices, contracts, paymentMethods] = await Promise.all([
        prisma.invoice.findMany({
            where: { organizationId: org.id },
            orderBy: { issuedAt: "desc" },
            take: 50,
            include: { project: { select: { name: true } } },
        }),
        prisma.contract.findMany({
            where: { organizationId: org.id },
            orderBy: { effectiveAt: "desc" },
        }),
        prisma.paymentMethod.findMany({
            where: { organizationId: org.id },
            orderBy: { isDefault: "desc" },
        }),
    ]);

    const invoiceWires: IInvoiceSummary[] = invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: toWireInvoiceStatus(inv.status),
        issuedAt: inv.issuedAt.toISOString(),
        dueAt: inv.dueAt.toISOString(),
        paidAt: toIso(inv.paidAt),
        total: dec(inv.total),
        currency: inv.currency,
        pdfUrl: inv.pdfUrl,
        projectName: inv.project?.name ?? null,
    }));

    const contractWires: IContractSummary[] = contracts.map((c) => ({
        id: c.id,
        title: c.title,
        status: mapContractStatus(c.status),
        signedAt: toIso(c.signedAt),
        effectiveAt: toIso(c.effectiveAt),
        expiresAt: toIso(c.expiresAt),
        pdfUrl: c.pdfUrl,
    }));

    const paymentMethodWires: IPaymentMethod[] = paymentMethods.map((pm) => ({
        id: pm.id,
        brand: pm.brand,
        last4: pm.last4,
        expiryMonth: pm.expiryMonth,
        expiryYear: pm.expiryYear,
        isDefault: pm.isDefault,
    }));

    const outstanding = invoiceWires
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((acc, i) => acc + Number(i.total), 0);

    const ytdPaid = invoiceWires
        .filter((i) => i.status === "paid")
        .reduce((acc, i) => acc + Number(i.total), 0);

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
        outstandingTotal: outstanding.toFixed(2),
        ytdPaid: ytdPaid.toFixed(2),
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
            project: { select: { name: true } },
        },
    });
    if (!inv) {
        throw new AppError(status.NOT_FOUND, "Invoice not found.", {
            code: "INVOICE_NOT_FOUND",
        });
    }

    return {
        id: inv.id,
        number: inv.number,
        status: toWireInvoiceStatus(inv.status),
        issuedAt: inv.issuedAt.toISOString(),
        dueAt: inv.dueAt.toISOString(),
        paidAt: toIso(inv.paidAt),
        total: dec(inv.total),
        currency: inv.currency,
        pdfUrl: inv.pdfUrl,
        projectName: inv.project?.name ?? null,
        subtotal: dec(inv.subtotal),
        tax: dec(inv.tax),
        notes: inv.notes,
        lines: inv.items.map((line) => ({
            id: line.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: dec(line.unitPrice),
            total: dec(line.total),
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
    if (!contract.pdfUrl) {
        throw new AppError(
            status.NOT_FOUND,
            "Contract PDF unavailable.",
            { code: "PDF_MISSING" },
        );
    }
    return { url: contract.pdfUrl, filename: `${contract.title}.pdf` };
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
    if (!inv.pdfUrl) {
        throw new AppError(
            status.NOT_FOUND,
            "Invoice PDF unavailable.",
            { code: "PDF_MISSING" },
        );
    }
    return { url: inv.pdfUrl, filename: `Invoice-${inv.number}.pdf` };
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

    const existing = await prisma.paymentAttempt.findUnique({
        where: { idempotencyKey },
    });
    if (existing) {
        return {
            id: existing.id,
            status: existing.status,
            invoiceId,
            amount: dec(existing.amount),
            processedAt: existing.createdAt.toISOString(),
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

    const method = await prisma.paymentMethod.findFirst({
        where: { id: body.paymentMethodId, organizationId: org.id },
    });
    if (!method) {
        throw new AppError(
            status.NOT_FOUND,
            "Payment method not found.",
            { code: "PAYMENT_METHOD_NOT_FOUND" },
        );
    }

    const attempt = await prisma.paymentAttempt.create({
        data: {
            organizationId: org.id,
            invoiceId,
            amount: inv.total,
            currency: inv.currency,
            method: method.brand,
            idempotencyKey,
            status: "SUCCEEDED",
        },
    });

    await prisma.$transaction([
        prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: "PAID", paidAt: new Date() },
        }),
        prisma.payment.create({
            data: {
                invoiceId,
                amount: inv.total,
                currency: inv.currency,
                methodId: method.id,
                reference: attempt.id,
            },
        }),
    ]);

    return {
        id: attempt.id,
        status: "succeeded",
        invoiceId,
        amount: dec(attempt.amount),
        processedAt: attempt.createdAt.toISOString(),
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