import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getDashboardContent, getDashboardSales } from '../../../apis/adminApi';
import { formatBytes, formatNumber, formatDateTime } from '../../../utils/format';

const EMPTY_SITE_CONTENT = {
  models: {
    m1: {}, m2: {}, m3: {}, m4: {}, m5: {}, m6: {}, m7: {},
    m8: {}, m9: {}, m10: {}, m11: {}, m12: {}, m13: {}, m14: {}
  },
  inventory: {
    totalSize: 427819008, // 408 MB
    fileCount: 223
  }
};

const EMPTY_SALES_STATE = {
  updatedAt: new Date().toISOString(),
  newOrderCount: 5,
  orders: [
    ...Array(28).fill({ status: 'finished' }),
    ...Array(12).fill({ status: 'processing' }),
  ]
};


/**
 * 后台仪表盘视图。
 * 这是管理员登录后看到的第一个页面，提供统计信息和功能入口。
 */
export default function DashboardView() {
  const [content, setContent] = useState(EMPTY_SITE_CONTENT);
  const [sales, setSales] = useState(EMPTY_SALES_STATE);

  useEffect(() => {
    // 并行获取数据
    Promise.all([
      getDashboardContent(),
      getDashboardSales()
    ]).then(([contentData, salesData]) => {
      console.log("仪表盘内容数据:", contentData);
      console.log("仪表盘销售数据:", salesData);
      if (contentData) {
        setContent(contentData);
      }
      if (salesData) {
        setSales(salesData);
      }
    }).catch(error => {
      console.error("获取仪表盘数据失败:", error);
      // 可以在这里设置错误状态并在 UI 中显示
    });
  }, []);

  const contentChartOption = useMemo(() => {
    const modelCount = content?.modelCount ?? 0;
    const fileCount  = content?.fileCount ?? 0;
    const totalSizeInMB = content?.totalSizeInMB ?? 0;

    return {
      title: {
        text: '资源总览',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#999' } }
      },
      grid: { top: '25%', left: '3%', right: '3%', bottom: '3%', containLabel: true },
      legend: {
        data: ['数量', '空间 (MB)'],
        top: 10,
        right: 10
      },
      xAxis: [{
        type: 'category',
        data: ['船型数量', '文件总数', '总占用空间'],
        axisPointer: { type: 'shadow' }
      }],
      yAxis: [
        {
          type: 'value',
          name: '数量',
          min: 0,
          axisLabel: { formatter: '{value}' }
        },
        {
          type: 'value',
          name: '空间 (MB)',
          min: 0,
          axisLabel: { formatter: '{value} MB' }
        }
      ],
      series: [
        {
          name: '数量',
          type: 'bar',
          tooltip: { valueFormatter: (value) => value },
          data: [modelCount, fileCount, null]
        },
        {
          name: '空间 (MB)',
          type: 'bar',
          yAxisIndex: 1,
          tooltip: { valueFormatter: (value) => value + ' MB' },
          data: [null, null, totalSizeInMB]
        }
      ]
    };
  }, [content]);

  const salesChartOption = useMemo(() => {
    const followingCount = sales.processingCount;
    const completedCount = sales.finishedCount;
    return {
      title: {
        text: '订单状态',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: { top: '15%', left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'value',
        boundaryGap: [0, 0.01]
      },
      yAxis: {
        type: 'category',
        data: ['已完成', '跟进中', '新提交']
      },
      series: [{
        name: '订单数量',
        type: 'bar',
        data: [completedCount, followingCount, sales.newOrderCount]
      }]
    };
  }, [sales]);


  return (
    <div>
      <div className="admin-hero-grid">
        <div className="admin-hero-card">
          <ReactECharts option={contentChartOption} style={{ height: '240px', width: '100%' }} />
        </div>
        <div className="admin-hero-card">
          <ReactECharts option={salesChartOption} style={{ height: '240px', width: '100%' }} />
          <div className="admin-hero-card-footer">
            最后更新于 {formatDateTime(sales.updatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}