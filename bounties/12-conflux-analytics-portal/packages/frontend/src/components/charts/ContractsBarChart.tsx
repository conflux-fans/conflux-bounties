import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { useTopContracts } from '../../api/hooks';

const COLOR = '#6366F1';

/** Horizontal bar chart showing top 10 contracts by gas used. */
export function ContractsBarChart() {
  const { data, isLoading } = useTopContracts('gas_used', 'desc');

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const rows = (data?.data ?? []).slice(0, 10).map((r) => ({
    name: r.dapp_name ?? `${r.contract_address.slice(0, 8)}...`,
    gas: Number(r.gas_used),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 20, left: 60, bottom: 10 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
        <XAxis type="number" hide />
        <YAxis
          dataKey="name"
          type="category"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          width={80}
        />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13 }}
          formatter={(v: number) => [v.toLocaleString(), 'Gas Used']}
        />
        <Bar dataKey="gas" fill={COLOR} radius={[0, 6, 6, 0]} barSize={14} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
