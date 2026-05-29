import React, { useState, useEffect } from 'react';
import { Descriptions, Input, Button, Empty, message as staticMessage, Select, Typography, App, Space, Collapse, Radio } from 'antd';
import { getAllCosModelPaths, getDescendantFilesByPath } from '../../../apis/adminApi';

const { Title } = Typography;

const ModelParametersPanel = ({ model, onModelChange }) => {
  const { message } = App.useApp();
  const [cosPaths, setCosPaths] = useState([]);
  const [files, setFiles] = useState([]);
  const [isLoadingPaths, setIsLoadingPaths] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

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

  const handlePathSelect = async (selectedPath) => {
    if (onModelChange) {
      onModelChange({ storagePath: selectedPath || '' });
    }
    if (selectedPath) {
      setIsLoadingFiles(true);
      try {
        const response = await getDescendantFilesByPath(selectedPath);
        setFiles(response.files || []);
      } catch (error) {
        console.error('Failed to fetch files:', error);
        message.error('获取文件列表失败');
      } finally {
        setIsLoadingFiles(false);
      }
    } else {
      setFiles([]);
    }
  };

  const handleRuntimeModelChange = (e) => {
    if (onModelChange) {
      onModelChange({ runtimeModelPath: e.target.value });
    }
  };

  const handleSaveModel = () => {
    // TODO: 实现调用 updateModel API 的逻辑
    staticMessage.info('保存功能待实现');
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
        <Descriptions.Item label="模型文件夹路径" labelStyle={{ width: '120px', whiteSpace: 'nowrap' }}>
          <Space.Compact style={{ display: 'flex' }}>
            <Select
              style={{ flex: 1 }}
              value={model?.storagePath || undefined} // 使用 undefined 来正确显示 placeholder
              placeholder={model ? "选择现有路径或上传新模型" : "请先选择一艘船"}
              disabled={!model}
              loading={isLoadingPaths}
              onChange={handlePathSelect}
              options={cosPaths}
              allowClear
            />
            <Button
              type="primary"
              onClick={() => staticMessage.info('上传功能待实现')}
              // 只有当模型存在且尚未选择任何路径（storagePath为空）时，才启用上传按钮
              disabled={!model || !!model?.storagePath}
            >
              上传
            </Button>
          </Space.Compact>
        </Descriptions.Item>
      </Descriptions>

      <Collapse defaultActiveKey={['1']} style={{ marginTop: '16px' }}>
        <Collapse.Panel header="模型资源" key="1">
          {isLoadingFiles ? (
            <p>加载中...</p>
          ) : files.length > 0 ? (
            (() => {
              const modelFiles = files.filter(file => 
                file.key.toLowerCase().endsWith('.fbx') || file.key.toLowerCase().endsWith('.glb')
              );
              const otherFiles = files.filter(file => !modelFiles.some(mf => mf.key === file.key));

              return (
                <div>
                  {modelFiles.length > 0 && (
                    <>
                      <div style={{ marginBottom: '8px', fontWeight: 500 }}>选择运行时模型:</div>
                      <Radio.Group 
                        onChange={handleRuntimeModelChange} 
                        value={model?.runtimeModelPath}
                        style={{ display: 'flex', flexDirection: 'column' }}
                      >
                        {modelFiles.map((file, index) => (
                          <Radio key={index} value={file.key}>{file.key}</Radio>
                        ))}
                      </Radio.Group>
                    </>
                  )}
                  {otherFiles.length > 0 && (() => {
                    const groupedFiles = otherFiles.reduce((acc, file) => {
                      const path = file.key;
                      const lastSlashIndex = path.lastIndexOf('/');
                      const dir = lastSlashIndex === -1 ? '(根目录)' : path.substring(0, lastSlashIndex);
                      const filename = lastSlashIndex === -1 ? path : path.substring(lastSlashIndex + 1);

                      if (!acc[dir]) {
                        acc[dir] = [];
                      }
                      acc[dir].push(filename);
                      return acc;
                    }, {});

                    return (
                      <>
                        {modelFiles.length > 0 && <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '12px 0' }} />}
                        <div style={{ marginTop: '8px', fontWeight: 500 }}>其他资源文件:</div>
                        {Object.entries(groupedFiles).map(([dir, filesInDir]) => (
                          <div key={dir} style={{ marginTop: '8px' }}>
                            <div style={{ color: 'rgba(0, 0, 0, 0.85)', paddingLeft: '8px' }}>{dir}</div>
                            <ul style={{ listStyleType: 'none', paddingLeft: '24px', margin: '4px 0 0 0' }}>
                              {filesInDir.map((filename, index) => (
                                <li key={index} style={{ padding: '2px 0', color: 'rgba(0, 0, 0, 0.45)' }}>
                                  {filename}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              );
            })()
          ) : (
            <Empty description="没有文件" />
          )}
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

export default ModelParametersPanel;