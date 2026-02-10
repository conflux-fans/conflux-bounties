'use client';

interface ResultCardProps {
  data: {
    answer?: string;
    payment?: {
      tx_hash: string;
      payer: string;
      amount: string;
      token: string;
    };
    model?: string;
    tokens_used?: number;
  };
  explorerUrl: string;
}

export default function ResultCard({ data, explorerUrl }: ResultCardProps) {
  const { payment } = data;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg mt-6 overflow-hidden">
      {/* Payment info */}
      {payment && (
        <div className="border-b border-gray-800 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded">
              PAID
            </span>
            <span className="text-sm text-gray-400">
              {payment.amount} {payment.token}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">TX Hash</span>
              <div className="text-gray-300 font-mono truncate">
                <a
                  href={`${explorerUrl}/tx/${payment.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {payment.tx_hash}
                </a>
              </div>
            </div>
            <div>
              <span className="text-gray-500">Payer</span>
              <div className="text-gray-300 font-mono truncate">{payment.payer}</div>
            </div>
          </div>
          {data.model && (
            <div className="text-xs text-gray-500 mt-1">
              Model: {data.model} | Tokens: {data.tokens_used}
            </div>
          )}
        </div>
      )}

      {/* Answer */}
      {data.answer && (
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">AI Response</h3>
          <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">{data.answer}</div>
        </div>
      )}
    </div>
  );
}
