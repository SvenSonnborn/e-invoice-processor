export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return (
    <div>
      <h1>Invoice {invoiceId}</h1>
      <p>Invoice detail content coming soon...</p>
    </div>
  );
}
