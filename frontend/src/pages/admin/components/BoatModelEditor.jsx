import React, { useState, useEffect, useMemo } from 'react';
import { Descriptions, Input, Button, Empty, message as staticMessage, Select, Typography, App, Space, Collapse, Radio, Card, Form, InputNumber, Popconfirm, Image } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getModelsByBoatEnName, updateModelsByBoatEnName } from '../../../apis/adminApi';
import { getGrandparentPath } from '../../../utils/utils_admin';
import { buildModelConfig4AdminPage } from '../runtime/tool_admin';

const { Title } = Typography;

const BoatModelEditor = ({ boat,     
  modelFolders = [], 
  isLoadingModelFolders = false, 
  onModelChange, 
  runtimeModelPath,
  cosOrigin,
   }) => {
  const { message } = App.useApp();
  const [selectedModelFolderName, setSelectedModelFolderName] = useState('');
  const [files, setFiles] = useState([]);
  const [boatModels, setBoatModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
 
  useEffect(() => {
    if (!boat?.boatEnName) {
      setBoatModels([]);
      return;
    }

    const fetchBoatModels = async () => {
      setIsLoadingModels(true);
      try {
        const models = await getModelsByBoatEnName(boat.boatEnName);
        setBoatModels(models || []);

        if (models && models.length > 0) {
          message.success(`成功获取 ${models.length} 个船型样式`);
          // 自动设置模型文件夹路径
          // 文件夹名称应与当前船只的 boatEnName 匹配
          const targetm = models.find(m => 
            m.modelRuntimePath && // 确保路径不为空 (null, undefined, "")
            m.modelRuntimePath.includes(boat.boatEnName) // 且包含指定名称
          ); 
          if (targetm) {
            console.log("targetm=",targetm)
            const parentPath = getGrandparentPath(targetm.modelRuntimePath);
            setSelectedModelFolderName(parentPath);
          } else {
            // 如果船型有样式模型，但在COS路径列表中找不到对应的文件夹，则清空选择
            setSelectedModelFolderName('');
            console.warn(`船型 ${boat.boatEnName} 存在样式模型，但在COS路径列表中未找到对应的文件夹。`);
          }
        } else {
          message.info(`船型 ${boat.boatEnName} 没有找到相关样式配置`);
          // 如果没有模型，也清空选择
          setSelectedModelFolderName('');
        }
      } catch (error) {
        message.error('获取船型样式数据失败');
        console.error('Failed to fetch boat models:', error);
        setBoatModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchBoatModels();
  }, [boat?.boatEnName, message]);

  const cosPaths = useMemo(() => (
    modelFolders.map((folder) => ({
      label: folder.modelFolderName,
      value: folder.modelFolderName,
    }))
  ), [modelFolders]);

  useEffect(() => {
    setSelectedModelFolderName('')
    setFiles([])
  }, [boat?.boatEnName]);

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

  const handleSaveModel = async () => {
    if (!boat?.boatEnName) {
      message.error('没有指定船型，无法保存');
      return;
    }

    if (boatModels.length === 0) {
      message.info('没有需要保存的默认样式模型。');
      return;
    }

    setIsSaving(true);
    try {
      await updateModelsByBoatEnName(boat.boatEnName, boatModels);
      message.success('默认样式模型保存成功！');
    } catch (error) {
      message.error('保存失败，请检查控制台获取更多信息');
      console.error('Failed to save boat models:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleModelChange = (index, field, value) => {
    const newModels = [...boatModels];
    newModels[index] = { ...newModels[index], [field]: value };
    setBoatModels(newModels);
  };

  const addDefaultStyleModel = () => {
    if (boatModels.length >= 4) {
      message.warning('最多只能添加4个默认样式模型');
      return;
    }
    setBoatModels([
      ...boatModels,
      {
        boatEnName: boat?.boatEnName || '',
        modelName: '',
        modelRuntimePath: '',
        exteriorName: '',
        exteriorDescr: '',
        exteriorAddedPrice: 0,
        interiorName: '',
        interiorDescr: '',
        interiorAddedPrice: 0,
        deckName: '',
        deckDescr: '',
        deckAddedPrice: 0,
        powerName: '',
        powerDescr: '',
        powerAddedPrice: 0,
        smartSystemName: '',
        smartSystemDescr: '',
        smartSystemAddedPrice: 0,
      },
    ]);
  };

  const removeDefaultStyleModel = (index) => {
    const newModels = boatModels.filter((_, i) => i !== index);
    setBoatModels(newModels);
  };


  if (!boat) {
    return <Empty description="请先在左侧选择一艘船" style={{ paddingTop: '60px' }} />;
  }

  const collapseItems = [
    {
      key: '1',
      label: '模型资源浏览',

      children: (
        <>
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
                                const modelConfig = buildModelConfig(subfolder, subfolderFiles, selectedKey);
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
        </>
      ),
    },
    {
      key: '2',
      label: '默认样式编辑',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {boatModels.map((model, index) => {
            const runtimeModelOptions = files
              .filter(file =>
                (file.key.toLowerCase().endsWith('.fbx') || file.key.toLowerCase().endsWith('.glb')) &&
                selectedModelFolderName &&
                file.key.startsWith(`${selectedModelFolderName}`)
              )
              .map(file => ({ label: file.key, value: file.key }));

            return (
              <Card
                key={index}
                title={`样式 ${index + 1}: ${model.modelName || '(未命名)'}`}
                size="small"
                extra={
                  <Popconfirm
                    title="确定要删除这个样式吗？"
                    onConfirm={() => removeDefaultStyleModel(index)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button icon={<DeleteOutlined />} danger type="link" />
                  </Popconfirm>
                }
              >
                <Form layout="horizontal" size="small">
                  <Form.Item
                    label="样式名称"
                    labelCol={{ span: 6 }}
                    wrapperCol={{ span: 18 }}
                    style={{ marginBottom: '8px' }}
                  >
                    <Input
                      value={model.modelName}
                      onChange={(e) => handleModelChange(index, 'modelName', e.target.value)}
                      placeholder="例如：运动版"
                    />
                  </Form.Item>
                  <Form.Item label="运行时模型路径 (ModelRuntimePath)" 
                        labelCol={{ span: 24 }}
                        wrapperCol={{ span: 24 }}
                        style={{ marginBottom: '8px' }}>
                    <Space.Compact style={{ width: '100%' }}>
                      <Select
                        value={model.modelRuntimePath || undefined}
                        onChange={(value) => handleModelChange(index, 'modelRuntimePath', value)}
                        options={runtimeModelOptions}
                        placeholder="请从下方选择模型文件"
                        disabled={!selectedModelFolderName}
                        allowClear
                        style={{ flex: 1 }}
                      />
                      <Button
                        onClick={() => handleDefaultStylePreview(model.modelRuntimePath)}
                        disabled={!model.modelRuntimePath}
                      >
                        预览
                      </Button>
                    </Space.Compact>
                  </Form.Item>
                  <Collapse size="small">
                    <Collapse.Panel header="外观" key="exterior">
                      <Form.Item label="外观名称" style={{ marginBottom: '8px' }}>
                        <Input value={model.exteriorName} onChange={(e) => handleModelChange(index, 'exteriorName', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="外观描述" style={{ marginBottom: '8px' }}>
                        <Input.TextArea rows={2} value={model.exteriorDescr} onChange={(e) => handleModelChange(index, 'exteriorDescr', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="外观加价" style={{ marginBottom: '8px' }}>
                        <InputNumber value={model.exteriorAddedPrice} onChange={(value) => handleModelChange(index, 'exteriorAddedPrice', value)} style={{ width: '100%' }} />
                      </Form.Item>
                    </Collapse.Panel>
                    <Collapse.Panel header="内饰" key="interior">
                      <Form.Item label="内饰名称" style={{ marginBottom: '8px' }}>
                        <Input value={model.interiorName} onChange={(e) => handleModelChange(index, 'interiorName', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="内饰描述" style={{ marginBottom: '8px' }}>
                        <Input.TextArea rows={2} value={model.interiorDescr} onChange={(e) => handleModelChange(index, 'interiorDescr', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="内饰加价" style={{ marginBottom: '8px' }}>
                        <InputNumber value={model.interiorAddedPrice} onChange={(value) => handleModelChange(index, 'interiorAddedPrice', value)} style={{ width: '100%' }} />
                      </Form.Item>
                    </Collapse.Panel>
                    <Collapse.Panel header="甲板" key="deck">
                      <Form.Item label="甲板名称" style={{ marginBottom: '8px' }}>
                        <Input value={model.deckName} onChange={(e) => handleModelChange(index, 'deckName', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="甲板描述" style={{ marginBottom: '8px' }}>
                        <Input.TextArea rows={2} value={model.deckDescr} onChange={(e) => handleModelChange(index, 'deckDescr', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="甲板加价" style={{ marginBottom: '8px' }}>
                        <InputNumber value={model.deckAddedPrice} 
                               onChange={(value) => handleModelChange(index, 'deckAddedPrice', value)} 
                               style={{ width: '100%' }} />
                      </Form.Item>
                    </Collapse.Panel>
                    <Collapse.Panel header="动力" key="power">
                      <Form.Item label="动力名称" style={{ marginBottom: '8px' }}>
                        <Input value={model.powerName} onChange={(e) => handleModelChange(index, 'powerName', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="动力描述" style={{ marginBottom: '8px' }}>
                        <Input.TextArea rows={2} value={model.powerDescr} 
                               onChange={(e) => handleModelChange(index, 'powerDescr', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="动力加价" style={{ marginBottom: '0px' }}>
                        <InputNumber value={model.powerAddedPrice} 
                                onChange={(value) => handleModelChange(index, 'powerAddedPrice', value)} 
                                style={{ width: '100%' }} />
                      </Form.Item>
                    </Collapse.Panel>
                    <Collapse.Panel header="智能系统" key="smartSystem">
                      <Form.Item label="智能系统名称" style={{ marginBottom: '8px' }}>
                        <Input value={model.smartSystemName} 
                              onChange={(e) => handleModelChange(index, 'smartSystemName', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="智能系统描述" style={{ marginBottom: '8px' }}>
                        <Input.TextArea rows={2} value={model.smartSystemDescr} 
                                onChange={(e) => handleModelChange(index, 'smartSystemDescr', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="智能系统加价" style={{ marginBottom: '0px' }}>
                        <InputNumber value={model.smartSystemAddedPrice} 
                                 onChange={(value) => handleModelChange(index, 'smartSystemAddedPrice', value)} 
                                 style={{ width: '100%' }} />
                      </Form.Item>
                    </Collapse.Panel>

                  </Collapse>
                </Form>
              </Card>
            );
          })}
          <Button type="dashed" onClick={addDefaultStyleModel} icon={<PlusOutlined />} disabled={boatModels.length >= 4}>
            添加默认样式
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={5} style={{ margin: 0 }}>
          {boat ? `船名: ${boat.boatName} (${boat.boatEnName})` : '模型参数配置'}
        </Title>
        <Button type="primary" onClick={handleSaveModel} disabled={!boat} loading={isSaving}>
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
 
          </Space.Compact>
        </Descriptions.Item>
      </Descriptions>

      <Collapse defaultActiveKey={['1', '2']} style={{ marginTop: '16px' }} items={collapseItems} />
    </div>
  );
};

export default BoatModelEditor;