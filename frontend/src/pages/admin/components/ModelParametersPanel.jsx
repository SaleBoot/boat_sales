import React, { useState, useEffect, useMemo } from 'react';
import { Descriptions, Input, Button, Empty, message as staticMessage, Select, Typography, App, Space, Collapse, Radio } from 'antd';

const { Title } = Typography;

const ModelParametersPanel = ({ boat,     
  modelFolders = [], 
  isLoadingModelFolders = false, 
  onModelChange, 
  runtimeModelPath
   }) => {
  const { message } = App.useApp();
  const [selectedModelFolderName, setSelectedModelFolderName] = useState('');
  const [files, setFiles] = useState([]);

  const cosPaths = useMemo(() => (
    modelFolders.map((folder) => ({
      label: folder.modelFolderName,
      value: folder.modelFolderName,
    }))
  ), [modelFolders]);

  useEffect(() => {
    setSelectedModelFolderName('')
    setFiles([])
  }, [boat?.ID]);

  useEffect(() => {
    if (!selectedModelFolderName) {
      setFiles([])
      return
    }

    const matchedFolder = modelFolders.find((folder) => folder.modelFolderName === selectedModelFolderName)
    setFiles((matchedFolder?.descendantFiles || []).map((file) => ({ key: file })))
  }, [modelFolders, selectedModelFolderName]);

  const handlePathSelect = (selectedPath) => {
    setSelectedModelFolderName(selectedPath || '')
  };

  const handleRuntimeModelChange = (e) => {
    if (onModelChange) {
      onModelChange(e.target.value);
    }
  };

  const handleSaveModel = () => {
    // TODO: 实现调用 updateModel API 的逻辑
    staticMessage.info('保存功能待实现');
  };

  if (!boat) {
    return <Empty description="请先在左侧选择一艘船" style={{ paddingTop: '60px' }} />;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={5} style={{ margin: 0 }}>
          {boat ? `船名: ${boat.boatName} (${boat.boatEnName})` : '模型参数配置'}
        </Title>
        <Button type="primary" onClick={handleSaveModel} disabled={!boat}>
          保存
        </Button>
      </div>
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="模型文件夹路径" labelStyle={{ width: '120px', whiteSpace: 'nowrap' }}>
          <Space.Compact style={{ display: 'flex' }}>
            <Select
              style={{ flex: 1 }}
              value={selectedModelFolderName || undefined}
              placeholder={boat ? "选择现有路径或上传新模型" : "请先选择一艘船"}
              disabled={!boat}
              loading={isLoadingModelFolders}
              onChange={handlePathSelect}
              options={cosPaths}
              allowClear
            />
            <Button
              type="primary"
              onClick={() => staticMessage.info('上传功能待实现')}
              // This logic needs to be updated based on the new data model
              disabled={!boat}
            >
              上传
            </Button>
          </Space.Compact>
        </Descriptions.Item>
      </Descriptions>

      <Collapse defaultActiveKey={['1']} style={{ marginTop: '16px' }}>
        <Collapse.Panel header="模型资源" key="1">
          {files.length > 0 ? (
            (() => {
              const modelFiles = files.filter(file => 
                file.key.toLowerCase().endsWith('.fbx') || file.key.toLowerCase().endsWith('.glb')
              );
              const otherFiles = files.filter(file => !modelFiles.some(mf => mf.key === file.key));

              return (
                <div>
                  {modelFiles.length > 0 && (() => {
                    const groupedModels = modelFiles.reduce((acc, file) => {
                      const path = file.key;
                      const lastDotIndex = path.lastIndexOf('.');
                      const baseName = lastDotIndex === -1 ? path : path.substring(0, lastDotIndex);

                      if (!acc[baseName]) {
                        acc[baseName] = [];
                      }
                      acc[baseName].push(file);
                      return acc;
                    }, {});

                    return (
                      <>
                        <div style={{ marginBottom: '8px', fontWeight: 500 }}>选择运行时模型:</div>
                        <Radio.Group
                          onChange={handleRuntimeModelChange}
                          value={runtimeModelPath || undefined}
                          style={{ display: 'flex', flexDirection: 'column' }}
                        >
                          {Object.entries(groupedModels).map(([baseName, filesInGroup], index) => (
                            <React.Fragment key={baseName}>
                              {index > 0 && <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '12px 0' }} />}
                              <div style={{ marginTop: '8px', marginBottom: '4px', fontWeight: 500, color: 'rgba(0, 0, 0, 0.88)' }}>
                                {baseName.substring(baseName.lastIndexOf('/') + 1)}
                              </div>
                              {filesInGroup.map(file => (
                                <Radio key={file.key} value={file.key} style={{ paddingLeft: '8px' }}>
                                  {file.key.toLowerCase().endsWith('.glb') ? `GLB 版本 (${file.key})` : file.key.toLowerCase().endsWith('.fbx') ? `FBX 版本 (${file.key})` : file.key}
                                </Radio>
                              ))}
                            </React.Fragment>
                          ))}
                        </Radio.Group>
                      </>
                    );
                  })()}
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