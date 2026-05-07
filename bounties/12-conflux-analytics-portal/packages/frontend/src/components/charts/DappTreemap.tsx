import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { useDappLeaderboard } from '../../api/hooks';

const COLORS = ['#6366F1', '#4ADE80', '#F59E0B', '#3B82F6', '#A78BFA', '#FB923C', '#EC4899', '#14B8A6'];

interface TreemapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  index: number;
}

/** Custom treemap content renderer matching the design palette. */
function CustomContent({ x, y, width, height, name, index }: TreemapContentProps) {
  if (width < 40 || height < 30) return null;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} fill={COLORS[index % COLORS.length]} opacity={0.9} />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={width > 80 ? 12 : 10}
        fontWeight={600}
      >
        {name.length > 12 ? name.slice(0, 10) + '...' : name}
      </text>
    </g>
  );
}

/** DApp gas usage treemap. */
export function DappTreemap({ category }: { category?: string }) {
  const { data, isLoading } = useDappLeaderboard(category);

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const treeData = (data?.data ?? []).map((d) => ({
    name: d.dapp_name,
    size: Number(d.gas_used),
  }));

  if (treeData.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400">No DApp data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={treeData}
        dataKey="size"
        nameKey="name"
        content={<CustomContent x={0} y={0} width={0} height={0} name="" index={0} />}
      >
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13 }}
          formatter={(v: number) => [v.toLocaleString(), 'Gas Used']}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}
