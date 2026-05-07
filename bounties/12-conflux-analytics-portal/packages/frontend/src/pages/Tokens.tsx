import { PageHeader } from '../components/common/PageHeader';
import { TokensTable } from '../components/widgets/TokensTable';

/** Tokens analytics page — token list with expandable holders. */
export default function Tokens() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tokens" subtitle="ERC-20 Analytics" widget="tokens" />

      <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6">
        <TokensTable />
      </div>
    </div>
  );
}
