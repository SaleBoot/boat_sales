import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  message,
  Col,
  Row,
  Typography,
  Table,
  Space,
  Modal,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  RedoOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

// --- Mock Data and API ---
const mockVideos = [
  {
    id: 1,
    videoTitle: '智能消防艇全景演示',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // A classic example
    videoDescription: '展示了最新款智能消防艇的360度操作演示和水炮测试。',
  },
  {
    id: 2,
    videoTitle: 'Bilibili-船舶制造全过程',
    videoUrl: 'https://www.bilibili.com/video/BV1GJ411x7h7', // A sample Bilibili video
    videoDescription: '从第一块钢板到下水仪式的完整记录。',
  },
];

const getVideos = async () => {
  console.log('模拟获取视频列表');
  return new Promise(resolve => setTimeout(() => resolve({ data: [...mockVideos] }), 500));
};

const addVideo = async (video) => {
  console.log('模拟新增视频', video);
  const newVideo = { ...video, id: Math.random() };
  mockVideos.push(newVideo);
  return new Promise(resolve => setTimeout(() => resolve({ success: true }), 500));
};

const deleteVideos = async (ids) => {
  console.log('模拟删除视频', ids);
  // This is a mock, so we don't actually mutate the original `mockVideos` array in a real scenario
  return new Promise(resolve => setTimeout(() => resolve({ success: true }), 500));
};
// --- End Mock ---


// --- Add Video Modal ---
const AddVideoModal = ({ open, onCancel, onFinish, loading }) => {
  const [form] = Form.useForm();

  const handleOk = () => {
    form.validateFields()
      .then(values => {
        onFinish(values);
        form.resetFields();
      })
      .catch(info => {
        console.log('Validate Failed:', info);
      });
  };

  return (
    <Modal
      title="新增视频"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" name="add_video_form">
        <Form.Item name="videoTitle" label="视频标题" rules={[{ required: true, message: '请输入视频标题' }]}>
          <Input placeholder="例如 智能消防艇全景演示" />
        </Form.Item>
        <Form.Item name="videoUrl" label="视频链接" rules={[{ required: true, message: '请输入视频链接' }, { type: 'url', message: '请输入有效的链接地址' }]}>
          <Input placeholder="输入 YouTube 或 Bilibili 链接" />
        </Form.Item>
        <Form.Item name="videoDescription" label="视频简介" rules={[{ required: true, message: '请输入视频简介' }]}>
          <Input.TextArea rows={4} placeholder="简单介绍一下视频内容..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};


// --- Main View ---
export default function VideoManagerView() {
  const [videos, setVideos] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const response = await getVideos();
      setVideos(response.data);
      if (response.data.length > 0) {
        setCurrentVideo(response.data[0]);
      }
      message.success('视频列表已刷新');
    } catch (error) {
      message.error('获取视频列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的视频。');
      return;
    }
    await deleteVideos(selectedRowKeys);
    message.success('删除成功');
    setSelectedRowKeys([]);
    fetchVideos();
  };

  const handleAddFinish = async (values) => {
    setIsSubmitting(true);
    try {
      await addVideo(values);
      message.success('视频添加成功！');
      setIsAddModalOpen(false);
      fetchVideos();
    } catch (error) {
      message.error('添加视频失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSelectChange = (keys) => {
    setSelectedRowKeys(keys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const columns = [
    { title: '视频标题', dataIndex: 'videoTitle', key: 'videoTitle' },
    { title: '视频链接', dataIndex: 'videoUrl', key: 'videoUrl', render: (url) => <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> },
    { title: '视频简介', dataIndex: 'videoDescription', key: 'videoDescription' },
  ];

  const getVideoEmbedElement = (videoUrl) => {
    if (!videoUrl) return <Empty description="请在左侧选择一个视频以预览" />;
    let embedUrl = '';
    try {
      const url = new URL(videoUrl);
      if (url.hostname.includes('youtube.com')) {
        const videoId = url.searchParams.get('v');
        if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (url.hostname.includes('bilibili.com')) {
        const videoId = url.pathname.split('/').find(part => part.startsWith('BV'));
        if (videoId) embedUrl = `//player.bilibili.com/player.html?bvid=${videoId}&page=1&autoplay=0&high_quality=1&danmaku=0`;
      }
    } catch (e) { /* Invalid URL */ }

    if (embedUrl) {
      return <iframe src={embedUrl} style={{ width: '100%', height: '100%', border: 'none' }} allow="fullscreen;" title="Embedded video" />;
    }
    return <Empty description="不支持的视频链接或格式错误" />;
  };

  return (
    <div style={{ padding: '20px' }}>
      <Row gutter={16}>
        <Col span={14}>
          <Card>
            <div style={{ marginBottom: '24px' }}>
              <Title level={4}>视频内容管理</Title>
              <Paragraph type="secondary">支持 YouTube 与 Bilibili 链接，保存后会进入前台视频模块。</Paragraph>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button icon={<RedoOutlined />} onClick={fetchVideos}>刷新列表</Button>
                <Button icon={<PlusOutlined />} onClick={() => setIsAddModalOpen(true)}>增加</Button>
                <Button icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0} onClick={handleDelete} danger>删除</Button>
              </Space>
              <Input.Search placeholder="按标题查询..." onSearch={() => message.info('查询功能待实现')} style={{ width: 250, float: 'right' }} />
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={videos}
              rowKey="id"
              loading={loading}
              onRow={(record) => ({ onClick: () => setCurrentVideo(record) })}
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="视频预览">
            <div style={{ position: 'relative', paddingTop: '56.25%', backgroundColor: '#000' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                {getVideoEmbedElement(currentVideo?.videoUrl)}
              </div>
            </div>
          </Card>
        </Col>
      </Row>
      <AddVideoModal
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        onFinish={handleAddFinish}
        loading={isSubmitting}
      />
    </div>
  );
}
