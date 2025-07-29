'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import './charts.css';

interface SeverityData {
  name: string;
  value: number;
  color: string;
}

interface SeverityDistributionProps {
  data: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  className?: string;
}

export function SeverityDistributionChart({
  data,
  className = '',
}: SeverityDistributionProps) {
  const chartData: SeverityData[] = [
    { name: 'Critical', value: data.critical, color: '#ef4444' },
    { name: 'High',     value: data.high,     color: '#f97316' },
    { name: 'Medium',   value: data.medium,   color: '#eab308' },
    { name: 'Low',      value: data.low,      color: '#22c55e' },
  ].filter(item => item.value > 0);

  const total = data.critical + data.high + data.medium + data.low;

  if (total === 0) {
    return (
      <div
        className={[
          'chart-empty',
          'chart-empty--distribution',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="chart-empty__inner">
          <div className="chart-empty__icon">📊</div>
          <p className="chart-empty__text">No findings to display</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={['chart-card', 'chart-card--distribution', className]
        .filter(Boolean)
        .join(' ')}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{
        y: -5,
        boxShadow:
          '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        transition: { type: 'spring', stiffness: 300, damping: 10 },
      }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="chart-card__title">Severity Distribution</h3>
      <div className="chart-content chart-content--distribution">
        <div className="chart-content__pie">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0];
                    return (
                      <div className="chart-tooltip">
                        <p className="chart-tooltip__title">
                          {d.payload.name}
                        </p>
                        <p className="chart-tooltip__value">
                          {d.value} finding
                          {d.value !== 1 ? 's' : ''} (
                          {((d.value as number / total) * 100).toFixed(1)}
                          %)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-legend chart-legend--distribution">
          {chartData.map((item, idx) => (
            <motion.div
              key={item.name}
              className="chart-legend__item"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
            >
              <div
                className="chart-legend__dot"
                style={{ backgroundColor: item.color }}
              />
              <span className="chart-legend__label">{item.name}</span>
              <span className="chart-legend__value">({item.value})</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface AuditStatsProps {
  stats: {
    totalFindings: number;
    processingTime: number;
    contractSize?: number;
    toolsUsed: string[];
  };
  className?: string;
}

export function AuditStatsCard({
  stats,
  className = '',
}: AuditStatsProps) {
  const statItems = [
    {
      label: 'Total Findings',
      value: stats.totalFindings,
      suffix: '',
      colorClass: 'stats-item__value--blue',
    },
    {
      label: 'Processing Time',
      value: (stats.processingTime / 1000).toFixed(1),
      suffix: 's',
      colorClass: 'stats-item__value--green',
    },
    {
      label: 'Tools Used',
      value: stats.toolsUsed.length,
      suffix: '',
      colorClass: 'stats-item__value--purple',
    },
  ];

  return (
    <motion.div
      className={['chart-card', 'chart-card--stats', className]
        .filter(Boolean)
        .join(' ')}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -5,
        boxShadow:
          '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        transition: { type: 'spring', stiffness: 300, damping: 10 },
      }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="chart-card__title">Audit Statistics</h3>
      <div className="stats-grid">
        {statItems.map((item, idx) => (
          <motion.div
            key={item.label}
            className="stats-item"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.3 }}
          >
            <span className="stats-item__label">{item.label}</span>
            <span className={['stats-item__value', item.colorClass]
              .filter(Boolean)
              .join(' ')}>
              {item.value}
              {item.suffix}
            </span>
          </motion.div>
        ))}
      </div>

      {stats.toolsUsed.length > 0 && (
        <div className="stats-tools">
          <h4 className="stats-tools__title">Analysis Tools</h4>
          <div className="stats-tools__list">
            {stats.toolsUsed.map((tool, idx) => (
              <motion.span
                key={tool}
                className="stats-tools__tag"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1, duration: 0.3 }}
              >
                {tool}
              </motion.span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface TrendChartProps {
  data: Array<{
    date: string;
    findings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  className?: string;
}

export function AuditTrendChart({
  data,
  className = '',
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={['chart-empty', 'chart-empty--trend', className]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="chart-empty__inner">
          <div className="chart-empty__icon">📈</div>
          <p className="chart-empty__text">No trend data available</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={['chart-card', 'chart-card--trend', className]
        .filter(Boolean)
        .join(' ')}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{
        y: -5,
        boxShadow:
          '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        transition: { type: 'spring', stiffness: 300, damping: 10 },
      }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="chart-card__title">Audit Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid className="chart-grid" />
          <XAxis className="chart-xaxis" dataKey="date" />
          <YAxis className="chart-yaxis" />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="chart-tooltip">
                    <p className="chart-tooltip__title">{label}</p>
                    {payload.map((entry, i) => (
                      <p
                        key={i}
                        className="chart-tooltip__entry"
                        style={{ color: entry.color }}
                      >
                        {entry.dataKey}: {entry.value}
                      </p>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="critical"
            stackId="a"
            fill="#ef4444"
            className="chart-bar chart-bar--critical"
          />
          <Bar
            dataKey="high"
            stackId="a"
            fill="#f97316"
            className="chart-bar chart-bar--high"
          />
          <Bar
            dataKey="medium"
            stackId="a"
            fill="#eab308"
            className="chart-bar chart-bar--medium"
          />
          <Bar
            dataKey="low"
            stackId="a"
            fill="#22c55e"
            className="chart-bar chart-bar--low"
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
