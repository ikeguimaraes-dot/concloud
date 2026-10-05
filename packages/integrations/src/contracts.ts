/** Future provider boundaries. No runtime connector is implemented or enabled. */
export type ProviderScope = { organizationId: string; companyId: string; actorId: string };
export type ExternalResult<T> = { externalId: string; idempotencyKey: string; data: T };
export interface InvoiceProvider {
  submitApprovedInvoice(
    scope: ProviderScope,
    approvedRequestId: string,
    idempotencyKey: string,
  ): Promise<ExternalResult<{ status: 'PENDING' | 'ISSUED' | 'REJECTED' }>>;
}
export interface BankDataProvider {
  listConsentedTransactions(
    scope: ProviderScope,
    connectionId: string,
    cursor?: string,
  ): Promise<{
    transactions: { externalId: string; amount: string; date: string; description: string }[];
    cursor?: string;
  }>;
}
export interface BillingProvider {
  createApprovedCharge(
    scope: ProviderScope,
    approvedRequestId: string,
    idempotencyKey: string,
  ): Promise<ExternalResult<{ status: 'PENDING' }>>;
}
export interface InsightProvider {
  explain(
    scope: ProviderScope,
    input: { authorizedSourceIds: string[]; question: string },
  ): Promise<{
    text: string;
    sourceIds: string[];
    model: string;
    modelVersion: string;
    requiresHumanApproval: true;
  }>;
}
// Domínio automation requires a verified vendor contract; ManualAccountingAdapter
// is the only supported accounting implementation. No API endpoints are assumed.
