/** C6 — Customer billing (contracts, invoices, payments). */

export type InvoiceStatusWire =
    | "draft"
    | "sent"
    | "paid"
    | "overdue"
    | "void";

export type ContractStatusWire = "active" | "expiring" | "expired" | "signed";

export type PaymentMethodWire = "card" | "bank" | "manual";

export interface IInvoiceLine {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface IInvoiceSummary {
    id: string;
    number: string;
    status: InvoiceStatusWire;
    issuedAt: string;
    dueAt: string;
    paidAt: string | null;
    total: number;
    currency: string;
    pdfUrl: string | null;
    projectName: string | null;
}

export interface IInvoiceDetail extends IInvoiceSummary {
    subtotal: number;
    tax: number;
    notes: string | null;
    lines: IInvoiceLine[];
    payments: IPaymentInfo[];
}

export interface IPaymentInfo {
    id: string;
    amount: number;
    status: string;
    provider: string;
    createdAt: string;
}

export interface IContractSummary {
    id: string;
    title: string;
    status: ContractStatusWire;
    signedAt: string | null;
    effectiveAt: string | null;
    expiresAt: string | null;
    pdfUrl: string | null;
}

export interface IPaymentMethod {
    id: string;
    brand: string;
    last4: string;
    expiryMonth: number | null;
    expiryYear: number | null;
    isDefault: boolean;
}

export interface IUpcomingCharge {
    description: string;
    amount: number;
    dueAt: string;
    invoiceId: string | null;
}

export interface ICustomerBilling {
    nextCharge: IUpcomingCharge | null;
    outstandingTotal: number;
    ytdPaid: number;
    paymentMethods: IPaymentMethod[];
    invoices: IInvoiceSummary[];
    contracts: IContractSummary[];
}