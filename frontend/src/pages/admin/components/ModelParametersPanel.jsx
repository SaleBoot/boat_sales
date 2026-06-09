import React, { useState, useEffect, useMemo } from 'react';
import { Descriptions, Input, Button, Empty, message as staticMessage, Select, Typography, App, Space, Collapse, Radio, Card, Form, InputNumber, Popconfirm, Image } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getModelsByBoatEnName, updateModelsByBoatEnName } from '../../../apis/adminApi';
import { getGrandparentPath } from '../../../utils/utils_admin';
import { buildModelConfig4AdminPage } from '../runtime/tool_admin';

const { Title } = Typography; 

const ModelParametersPanel = ({ boat,     
  modelFolders = [], 
  isLoadingModelFolders = false, 
  onModelChange, 
  runtimeModelPath,
  cosOrigin,
   }) => {
  const { message } = App.useApp();
  const [selectedModelFolderName, setSelectedModelFolderName] = useState('');
  const [files, setFiles] = useState([]); 
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
 
  
  const cosPaths = useMemo(() => (
    modelFolders.map((folder) => ({
      label: folder.modelFolderName,
      value: folder.modelFolderName,
    }))
  ), [modelFolders]);
 
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

 

  const handleDefaultStylePreview = (runtimePath) => {
    if (!runtimePath || !onModelChange) return;

    // 1. Find the correct parent folder using original paths, which have leading slashes.
    const parentFolder = modelFolders.find(folder => runtimePath.startsWith(folder.modelFolderName));

    if (!parentFolder) {
        message.error('无法在可用模型文件夹中找到该路径。');
        console.error(`Path "${runtimePath}" not found in any modelFolders.`);
        return;
    }

    // 2. Extract subfolder name. Clean the path only for the split operation.
    const relativePath = runtimePath.substring(parentFolder.modelFolderName.length);
    const subfolderName = relativePath.replace(/^\//, '').split('/')[0];

    if (!subfolderName) {
        message.warn('无法从路径中确定子文件夹。');
        console.error(`Could not determine subfolder from runtimePath: "${runtimePath}"`);
        return;
    }

    // 3. Construct the prefix using original folder name to match descendantFiles format.
    const subfolderPrefix = `${parentFolder.modelFolderName}/${subfolderName}/`;

    // 4. Filter original descendantFiles, which have leading slashes.
    const subfolderFilePaths = parentFolder.descendantFiles.filter(f => f.startsWith(subfolderPrefix));

    // 5. Create file objects for buildModelConfig4AdminPage. The `key` must NOT have a leading slash.
    const subfolderFileObjects = subfolderFilePaths.map(f => ({ key: f.replace(/^\//, '') }));

    // 6. Build config and emit
    if (subfolderFileObjects.length > 0) {
        const modelConfig = buildModelConfig4AdminPage(subfolderName, subfolderFileObjects, runtimePath);
        // Pass the original runtimePath to keep the selection correct in the UI
        onModelChange(modelConfig, runtimePath);
    } else {
        message.warn('在当前文件夹中找不到预览所需的模型文件。');
    }
  };
     
  return (
    <div style={{ padding: '24px' }}>
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="模型文件夹路径" labelStyle={{ width: '120px', whiteSpace: 'nowrap' }}>
          <Space.Compact style={{ display: 'flex' }}>
            <Select
              style={{ flex: 1 }}
              value={selectedModelFolderName || undefined}
              placeholder={ "选择现有路径或上传新模型" }
              loading={isLoadingModelFolders}
              onChange={handlePathSelect}
              options={cosPaths}
              allowClear
            />
            <Button
              type="primary"
              onClick={() => staticMessage.info('上传功能待实现')}
              // This logic needs to be updated based on the new data model
            >
              上传
            </Button>
          </Space.Compact>
        </Descriptions.Item>
      </Descriptions>

      {/* 模型资源浏- 现在是标题，下面的子折叠项目已上提 */}
      <div style={{ marginTop: '16px' }}>
        <Title level={5} style={{ marginBottom: '12px' }}>模型资源</Title>
        
        {files.length > 0 ? (
          (() => {
            // 1. 按子文件夹分组
            // 这是新代码
            const groupedBySubfolder = files.reduce((acc, file) => {
              // 构造要查找的父文件夹路径，确保末尾有斜杠
              const parentPath = `${selectedModelFolderName}/`;
              const parentPathIndex = file.key.indexOf(parentPath);

              // 如果文件路径不包含父文件夹，则跳过
              if (parentPathIndex === -1) {
                return acc;
              }

              // 提取父文件夹之后的部分
              const remainingPath = file.key.substring(parentPathIndex + parentPath.length);
              const remainingParts = remainingPath.split('/');

              let subfolder;
              // 如果剩余部分包含斜杠，说明文件在子文件夹内
              if (remainingParts.length > 1) {
                subfolder = remainingParts[0]; // 这就是子文件夹名，例如 '57sites01'
              } else {
                // 否则，文件直接在父文件夹下
                subfolder = '(根目录文件)';
              }

              if (!acc[subfolder]) {
                acc[subfolder] = [];
              }
              acc[subfolder].push(file);
              return acc;
            }, {});

            const subfolders = Object.keys(groupedBySubfolder);
            if (subfolders.length === 0) {
              return <Empty description="没有找到子文件夹" />;
            }

            // 2. 为每个子文件夹创建一个 Collapse
            return (
           
              <Collapse defaultActiveKey={subfolders}>
                {subfolders.map(subfolder => {
                  const subfolderFiles = groupedBySubfolder[subfolder];

                  // 3. 在每个子文件夹内部进行分类
                  const adImages = subfolderFiles.filter(file => {
                    const lowerKey = file.key.toLowerCase();
                    const fileName = lowerKey.substring(lowerKey.lastIndexOf('/') + 1);
                    return fileName.startsWith('adimg') && (lowerKey.endsWith('.png') || lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg'));
                  });

                  const modelFiles = subfolderFiles.filter(file => 
                    file.key.toLowerCase().endsWith('.fbx') || file.key.toLowerCase().endsWith('.glb')
                  );
                  
                  const otherFiles = subfolderFiles.filter(file => 
                    !adImages.some(img => img.key === file.key) && 
                    !modelFiles.some(mf => mf.key === file.key)
                  );

                  return (
                    <Collapse.Panel header={subfolder} key={subfolder}>
                      {adImages.length > 0 && (
                        <>
                          <Collapse size="small" ghost defaultActiveKey={['1']}>
                            <Collapse.Panel header={`宣传图预览 (${adImages.length}张)`} key="1">
                              <Image.PreviewGroup>
                                <Space wrap>
                                  {adImages.map(image => (
                                    <Image
                                      key={image.key}
                                      width={80}
                                      height={80}
                                      src={`${cosOrigin}/${image.key}`}
                                      alt={image.key}
                                      style={{ objectFit: 'cover' }}
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ))}
                                </Space>
                              </Image.PreviewGroup>
                            </Collapse.Panel>
                          </Collapse>
                          {(modelFiles.length > 0 || otherFiles.length > 0) && 
                            <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '12px 0' }} />}
                        </>
                      )}


                      {modelFiles.length > 0 && (
                        <>
                          <div style={{ marginBottom: '8px', fontWeight: 500 }}>选择模型进行预览:</div>
                          <Radio.Group
                            value={runtimeModelPath}
                            onChange={(e) => {
                              const selectedKey = e.target.value;
                              const modelConfig = buildModelConfig4AdminPage(subfolder, subfolderFiles, selectedKey);
                              if (onModelChange) {
                                onModelChange(modelConfig, selectedKey);
                              }
                            }}
                            style={{ width: '100%' }}
                          >
                            <Space direction="vertical" style={{ width: '100%' }}>
                              {modelFiles.map(file => (
                                <Radio key={file.key} value={file.key}>
                                  {file.key.substring(file.key.lastIndexOf('/') + 1)}
                                </Radio>
                              ))}
                            </Space>
                          </Radio.Group>
                        </>
                      )}


                      {otherFiles.length > 0 && (
                        <>
                          {(modelFiles.length > 0 || adImages.length > 0) && 
                          <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '12px 0' }} />
                          }
                          <Collapse size="small" ghost>
                            <Collapse.Panel header={`其他资源文件 (${otherFiles.length}个)`} key="other-files">
                              <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
                                {otherFiles.map(file => (
                                  <li key={file.key} style={{ padding: '2px 0' }}>
                                    <Typography.Text type="secondary">{file.key}</Typography.Text>
                                  </li>
                                ))}
                              </ul>
                            </Collapse.Panel>
                          </Collapse>
                        </>
                      )}

                    </Collapse.Panel>
                  );
                })}
              </Collapse>
            );
          })()
        ) : (
          <Empty description="请先选择一个模型文件夹路径" />
        )}
      </div>
    </div>
  );
};

export default ModelParametersPanel;