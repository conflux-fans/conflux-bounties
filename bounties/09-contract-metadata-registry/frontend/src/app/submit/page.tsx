import { Suspense } from 'react';
import { SubmissionForm } from '../../components/SubmissionForm';

export default function SubmitPage() {
  return (
    <div className="page-section container-narrow">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[rgb(var(--color-text))] sm:text-4xl">
            Register contract metadata
          </h1>
          <p className="mt-2 text-[rgb(var(--color-text-muted))]">
            Add your contract address, project details, and ABI. You will sign with your wallet and submit to the registry.
          </p>
        </div>
        <Suspense fallback={<div className="text-[rgb(var(--color-text-muted))]">Loading form…</div>}>
          <SubmissionForm />
        </Suspense>
      </div>
    </div>
  );
}
