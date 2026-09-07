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
import { getVideos, addVideo, updateVideo, deleteVideos } from '../../../apis/adminApi'; // Import actual API functions

const { Title, Paragraph } = Typography;

// --- End Mock ---


// --- Video Form Modal (for Add and Edit) ---
const VideoFormModal = ({ open, onCancel, onFinish, loading, video }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && video) {
      form.setFieldsValue(video);
    } else if (open && !video) {
      form.resetFields();
    }
  }, [open, video, form]);

  const handleOk = () => {
    form.validateFields()
      .then(values => {
        onFinish(values);
      })
      .catch(info => {
        console.log('Validate Failed:', info);
      });
  };

  return (
    <Modal
      title={video ? "编辑视频" : "新增视频"}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" name="video_form">
        <Form.Item name="title" label="视频标题" rules={[{ required: true, message: '请输入视频标题' }]}>
          <Input placeholder="例如 智能消防艇全景演示" />
        </Form.Item>
        <Form.Item name="url" label="视频链接" rules={[{ required: true, message: '请输入视频链接' }, { type: 'url', message: '请输入有效的链接地址' }]}>
          <Input placeholder="输入 YouTube 或 Bilibili 链接" />
        </Form.Item>
        <Form.Item name="introduction" label="视频简介" rules={[{ required: true, message: '请输入视频简介' }]}>
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // New state for edit modal
  const [editingVideo, setEditingVideo] = useState(null); // New state for video being edited
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const response = await getVideos(); // Use actual API function
      console.log('Fetched videos:', response); // Log the response to inspect video object structure
      setVideos(response);
      if (response.length > 0) {
        setCurrentVideo(response[0]);
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

  const handleEdit = (record) => {
    setEditingVideo(record);
    setIsEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的视频。');
      return;
    }
    await deleteVideos(selectedRowKeys); // Use actual API function
    message.success('删除成功');
    setSelectedRowKeys([]);
    fetchVideos();
  };

  const handleFormFinish = async (values) => { // Renamed from handleAddFinish
    setIsSubmitting(true);
    try {
      if (editingVideo) {
        console.log('Editing video before update:', editingVideo); // Add this line
        await updateVideo(editingVideo.ID, values); // Use updateVideo for editing
        message.success('视频更新成功！');
      } else {
        await addVideo(values);
        message.success('视频添加成功！');
      }
      setIsAddModalOpen(false);
      setIsEditModalOpen(false); // Close edit modal
      setEditingVideo(null); // Clear editing video
      fetchVideos();
    } catch (error) {
      message.error('保存视频失败');
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
    { title: '视频标题', dataIndex: 'title', key: 'title' },
    { title: '视频链接', dataIndex: 'url',   key: 'url', 
      render: (url) => <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> },
    { title: '视频简介', dataIndex: 'introduction', key: 'introduction' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <a onClick={() => handleEdit(record)}>编辑</a>
        </Space>
      ),
    },
  ];

  const getVideoEmbedElement = (videoUrl) => {
    if (!videoUrl) 
      return <Empty description="请在左侧选择一个视频以预览" />;
    let embedUrl = '';
    
    try {
      const url = new URL(videoUrl);

      if (url.hostname.includes('youtube.com')) {
        const videoId = url.searchParams.get('v');
        if (videoId) 
          embedUrl = `https://www.youtube.com/embed/${videoId}`;

      } else if (url.hostname.includes('bilibili.com')) {
        
        const videoId = url.pathname.split('/').find(part => part.startsWith('BV'));
        if (videoId) 
          embedUrl = `//player.bilibili.com/player.html?bvid=${videoId}&page=1&autoplay=0&high_quality=1&danmaku=0`;
      }
    } catch (e) { 
      /* Invalid URL */ 
    }

    if (embedUrl) {
      return <iframe src={embedUrl} 
                    style={{ width: '100%', height: '100%', border: 'none' }} 
                    allow="fullscreen;" title="Embedded video" />;
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
                <Button icon={<DeleteOutlined />} 
                        disabled={selectedRowKeys.length === 0} 
                        onClick={handleDelete} danger>删除</Button>
              </Space>
              <Input.Search placeholder="按标题查询..." 
                            onSearch={() => message.info('查询功能待实现')} 
                            style={{ width: 250, float: 'right' }} />
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={videos}
              rowKey="ID"
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
                {getVideoEmbedElement(currentVideo?.url)}
              </div>
            </div>
          </Card>
        </Col>
      </Row>
      <VideoFormModal // Use the refactored modal
        open={isAddModalOpen || isEditModalOpen} // Open if either add or edit is active
        onCancel={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setEditingVideo(null);
        }}
        onFinish={handleFormFinish}
        loading={isSubmitting}
        video={editingVideo} // Pass the video for editing
      />
    </div>
  );
}