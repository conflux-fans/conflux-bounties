import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useDailyFees } from '../../api/hooks';

const COLORS = ['#1A1A1A', '#4ADE80'];

/** Gas breakdown donut chart — burned vs priority tips. */
export function GasCategoryChart() {
  const { data, isLoading } = useDailyFees();

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const rows = data?.data ?? [];
  const totalBurned = rows.reduce((s, r) => s + Number(r.total_burned), 0);
  const totalTips = rows.reduce((s, r) => s + Number(r.total_tips), 0);
  const total = totalBurned + totalTips;

  const chartData = [
    { name: 'Base Fee Burned', value: totalBurned },
    { name: 'Priority Tips', value: totalTips },
  ].filter((d) => d.value > 0);

  if (chartData.length === 0) {
    chartData.push({ name: 'No Data', value: 1 });
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6">
      <div className="w-full text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Gas Breakdown</div>

      <ResponsiveContainer width="100%" height="75%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="88%"
            dataKey="value"
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {chartData.map((_entry, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13 }}
            formatter={(v: number, name: string) => [
              `${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex gap-5">
        {chartData.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-secondary">{d.name}</span>
            <span className="font-bold">
              {total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
