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
    unitPrice: string;
    total: string;
}

export interface IInvoiceSummary {
    id: string;
    number: string;
    status: InvoiceStatusWire;
    issuedAt: string;
    dueAt: string;
    paidAt: string | null;
    total: string;
    currency: string;
    pdfUrl: string | null;
    projectName: string | null;
}

export interface IInvoiceDetail extends IInvoiceSummary {
    subtotal: string;
    tax: string;
    notes: string | null;
    lines: IInvoiceLine[];
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
    amount: string;
    dueAt: string;
    invoiceId: string | null;
}

export interface ICustomerBilling {
    nextCharge: IUpcomingCharge | null;
    outstandingTotal: string;
    ytdPaid: string;
    paymentMethods: IPaymentMethod[];
    invoices: IInvoiceSummary[];
    contracts: IContractSummary[];
}