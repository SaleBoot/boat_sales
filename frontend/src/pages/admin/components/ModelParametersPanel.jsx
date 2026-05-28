import React, { useState, useEffect } from 'react';
import { Descriptions, Input, Button, Empty, message, Select, Typography } from 'antd';
import { getAllCosModelPaths } from '../../../apis/adminApi';

const { Title } = Typography;

const ModelParametersPanel = ({ model, onModelChange }) => {
  const [cosPaths, setCosPaths] = useState([]);
  const [isLoadingPaths, setIsLoadingPaths] = useState(false);

  useEffect(() => {
    const fetchPaths = async () => {
      if (!model) {
        setCosPaths([]);
        return;
      }
      setIsLoadingPaths(true);
      try {
        // The API returns an object like { directories: [...] }
        const response = await getAllCosModelPaths();
        // We need to extract the array from the response object.
        const directories = response.directories || [];
        const formattedPaths = directories.map(p => ({ label: p, value: p }));
        setCosPaths(formattedPaths);
      } catch (error) {
        console.error('Failed to fetch COS paths:', error);
        message.error('获取模型路径列表失败');
      } finally {
        setIsLoadingPaths(false);
      }
    };

    fetchPaths();
  }, [model]);

  const handleCopyPath = () => {
    if (model?.storagePath) {
      navigator.clipboard.writeText(model.storagePath)
        .then(() => message.success('路径已复制到剪贴板'))
        .catch(err => {
          message.error('复制失败');
          console.error('无法复制文本: ', err);
        });
    }
  };

  const handlePathSelect = (selectedPath) => {
    if (onModelChange) {
      // 如果用户清空了选择，我们传递一个空字符串
      onModelChange({ storagePath: selectedPath || '' });
    }
  };

  const handleSaveModel = () => {
    // TODO: 实现调用 updateModel API 的逻辑
    message.info('保存功能待实现');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={5} style={{ margin: 0 }}>
          {model ? `模型: ${model.modelName}` : '模型参数配置'}
        </Title>
        <Button type="primary" onClick={handleSaveModel} disabled={!model}>
          保存
        </Button>
      </div>
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="模型文件夹路径" labelStyle={{ whiteSpace: 'nowrap' }}>
          <Input.Group compact style={{ display: 'flex' }}>
            <Select
              style={{ flex: 1 }}
              value={model?.storagePath || undefined} // 使用 undefined 来正确显示 placeholder
              placeholder={model ? "从现有路径中选择或上传新模型" : "请先选择一艘船"}
              disabled={!model}
              loading={isLoadingPaths}
              onChange={handlePathSelect}
              options={cosPaths}
              allowClear
            />
            <Button
              type="primary"
              onClick={() => message.info('上传功能待实现')}
              // 只有当模型存在且尚未选择任何路径（storagePath为空）时，才启用上传按钮
              disabled={!model || !!model?.storagePath}
            >
              上传
            </Button>
            <Button onClick={handleCopyPath} disabled={!model?.storagePath}>
              复制
            </Button>
          </Input.Group>
        </Descriptions.Item>
        {model ? (
          <>
            <Descriptions.Item label="FBX 文件名">{model.fbxFileName || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="GLB 文件名">{model.glbFileName || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="材质槽数组">{(model.materialSlots || []).join(', ')}</Descriptions.Item>
            <Descriptions.Item label="UV 目录">{model.uvDir1 || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="UV 目录 2">{model.uvDir2 || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="UV 目录 3">{model.uvDir3 || 'N/A'}</Descriptions.Item>
          </>
        ) : (
          <Descriptions.Item>
            <Empty description="未找到关联的模型或未选择船舶" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Descriptions.Item>
        )}
      </Descriptions>
    </div>
  );
};

export default ModelParametersPanel;