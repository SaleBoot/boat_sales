import React, { useState, useEffect, useMemo } from 'react';
import { Descriptions, Input, Button, Empty, message as staticMessage, Select, Typography, App, Space, Collapse, Radio, Card, Form, InputNumber, Popconfirm, Image } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getModelsByBoatEnName, updateModelsByBoatEnName } from '../../../apis/adminApi';
import { getGrandparentPath } from '../../../utils/utils_admin';

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

  const handleRuntimeModelChange = (e) => {
    if (onModelChange) {
      onModelChange(e.target.value);
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
              const adImages = files.filter(file => {
                const lowerKey = file.key.toLowerCase();
                const fileName = lowerKey.substring(lowerKey.lastIndexOf('/') + 1);
                return fileName.startsWith('adimg') && (lowerKey.endsWith('.png') || lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg'));
              });

              const modelFiles = files.filter(file => 
                file.key.toLowerCase().endsWith('.fbx') || file.key.toLowerCase().endsWith('.glb')
              );
              const otherFiles = files.filter(file => 
                !adImages.some(img => img.key === file.key) && 
                !modelFiles.some(mf => mf.key === file.key)
              );

              return (
                <div>
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
                                />
                              ))}
                            </Space>
                          </Image.PreviewGroup>
                        </Collapse.Panel>
                      </Collapse>
                      {(modelFiles.length > 0 || otherFiles.length > 0) && <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '12px 0' }} />}
                    </>
                  )}

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
                        <div style={{ marginBottom: '8px', fontWeight: 500 }}>选择模型进行预览:</div>
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
        </>
      ),
    },
    {
      key: '2',
      label: '默认样式模型编辑',
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
                <Form layout="vertical" size="small">
                  <Form.Item label="样式名称 (ModelName)" style={{ marginBottom: '8px' }}>
                    <Input
                      value={model.modelName}
                      onChange={(e) => handleModelChange(index, 'modelName', e.target.value)}
                      placeholder="例如 01, 02..."
                    />
                  </Form.Item>
                  <Form.Item label="运行时模型路径 (ModelRuntimePath)" style={{ marginBottom: '8px' }}>
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
                        onClick={() => onModelChange(model.modelRuntimePath)}
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
                        <InputNumber value={model.deckAddedPrice} onChange={(value) => handleModelChange(index, 'deckAddedPrice', value)} style={{ width: '100%' }} />
                      </Form.Item>
                    </Collapse.Panel>
                    <Collapse.Panel header="动力" key="power">
                      <Form.Item label="动力名称" style={{ marginBottom: '8px' }}>
                        <Input value={model.powerName} onChange={(e) => handleModelChange(index, 'powerName', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="动力描述" style={{ marginBottom: '8px' }}>
                        <Input.TextArea rows={2} value={model.powerDescr} onChange={(e) => handleModelChange(index, 'powerDescr', e.target.value)} />
                      </Form.Item>
                      <Form.Item label="动力加价" style={{ marginBottom: '0px' }}>
                        <InputNumber value={model.powerAddedPrice} onChange={(value) => handleModelChange(index, 'powerAddedPrice', value)} style={{ width: '100%' }} />
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

      <Collapse defaultActiveKey={['1', '2']} style={{ marginTop: '16px' }} items={collapseItems} />
    </div>
  );
};

export default ModelParametersPanel;