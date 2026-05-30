import React, { useState, useEffect, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Input,
  Space,
  Empty,
  Tabs,
  Form,
  Modal,
  App,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import ShipScene from '../../scene3d/ShipScene.jsx';
import { getBoatCategories, getBoats, addBoat, updateBoat, deleteBoats } from '../../../apis/adminApi';
import BoatListSider from '../components/BoatListSider';
import BoatInfoPanel from '../components/BoatInfoPanel.jsx';
import ModelParametersPanel from '../components/ModelParametersPanel.jsx';
import Inspector from '../components/Inspector.jsx';
import Inspector01 from '../components/Inspector01.jsx';
import AddBoatModal from './BoatAddModal.jsx';

/**
 * 船模管理视图
 */
export default function BoatModelsView() {
  const { message: messageApi } = App.useApp();

  const [boats, setBoats] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentBoat, setCurrentBoat] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [boatCategories, setBoatCategories] = useState([]);
  const [form] = Form.useForm();

  const remoteFBXOrigin = import.meta.env.VITE_REMOTE_FBX_ORIGIN;
  const fbxBaseUrl = `${remoteFBXOrigin}/gltf01/`;

  const boatTypeMap = useMemo(() => {
    if (!boatCategories) return {};
    return boatCategories.reduce((acc, cat) => {
      acc[cat.englishName] = cat.chineseName;
      return acc;
    }, {});
  }, [boatCategories]);

  const fetchBoats = async (filters = {}) => {
    setLoading(true);
    try {
      const response = await getBoats(filters);
      const boatsData = (response || []).map(({ id, Id, iD, ID, ...rest }) => ({
        ID: id ?? Id ?? iD ?? ID,
        ...rest
      }));
      setBoats(boatsData);

      if (!currentBoat && boatsData.length > 0) {
        setCurrentBoat(boatsData[0]);
      } else if (currentBoat) {
        const newCurrentBoat = boatsData.find(b => b.ID === currentBoat.ID);
        if (!newCurrentBoat) {
          setCurrentBoat(boatsData.length > 0 ? boatsData[0] : null);
        }
      }
      
      messageApi.success('船舶列表已刷新');
    } catch (error) {
      messageApi.error('获取船舶列表失败');
      console.error("Failed to fetch boats:", error);
    } finally {
      setLoading(false);
    }
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的船舶。');
      return;
    }
    try {
      await deleteBoats(selectedRowKeys);
      messageApi.success('船舶删除成功');
      fetchBoats();
      setSelectedRowKeys([]);
    } catch (error) {
      messageApi.error('删除船舶失败');
    }
  };

  const handleAddComplete = async (values) => {
    setIsSubmitting(true);
    try {
      await addBoat(values);
      messageApi.success('船舶添加成功');
      setIsAddModalOpen(false);
      fetchBoats();
    } catch (error) {
      messageApi.error(error.message || '添加船舶失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBoat = async (values) => {
    if (!currentBoat) {
      messageApi.error('请先选择一艘船');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateBoat(currentBoat.ID, values);
      messageApi.success('船舶信息更新成功');
      await fetchBoats();
    } catch (error) {
      messageApi.error('更新失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [categoriesResponse, boatsResponse] = await Promise.all([
        getBoatCategories(),
        getBoats(),
      ]);
      
      setBoatCategories(categoriesResponse || []);

      const boatsData = (boatsResponse || []).map(({ id, Id, iD, ID, ...rest }) => ({
        ID: id ?? Id ?? iD ?? ID,
        ...rest
      }));
      setBoats(boatsData);
      
      if (boatsData.length > 0) {
        setCurrentBoat(boatsData[0]);
      }
      
    } catch (error) {
      messageApi.error('初始化数据失败');
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (currentBoat) {
      setTimeout(() => {
        form.setFieldsValue(currentBoat);
      }, 0);
    }
  }, [currentBoat, form]);

  const tabItems = [
    {
      key: '1',
      label: '船舶基础信息',
      children: (
        <div className="admin-boat-model-tab-pane">
          <BoatInfoPanel
            boat={currentBoat}
            boatCategories={boatCategories}
            form={form}
            onUpdate={handleUpdateBoat}
            isSubmitting={isSubmitting}
          />
        </div>
      ),
    },
    {
      key: '2',
      label: '模型参数配置',
      children: (
        <div className="admin-boat-model-tab-pane">
          <ModelParametersPanel
            boat={currentBoat}
            // onModelChange is now handled internally or via form
          />
        </div>
      ),
    },
    {
      key: '3',
      label: 'Inspector',
      children: <div className="admin-boat-model-tab-pane"><Inspector /></div>,
    },
    {
      key: '4',
      label: 'Inspector01',
      children: <div className="admin-boat-model-tab-pane"><Inspector01 /></div>,
    },
  ];

  return (
    <div style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column', padding: '1px' }}>
      <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
        {/* 左侧列表 */}
        <Col span={8} style={{ height: '100%' }}>
          <BoatListSider
            loading={loading}
            boats={boats}
            boatCategories={boatCategories}
            selectedRowKeys={selectedRowKeys}
            onRefresh={() => fetchBoats()}
            onAdd={() => setIsAddModalOpen(true)}
            onDelete={handleDelete}
            onCategoryChange={(value) => fetchBoats({ category: value })}
            onSelectChange={onSelectChange}
            onRowClick={(record) => {
              setCurrentBoat(record);
              messageApi.info(`已选择船舶: ${record.boatName}`);
            }}
            boatTypeMap={boatTypeMap}
          />
        </Col>

        {/* 中间预览 */}
        <Col span={8} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            border: '1px solid #f0f0f0', 
            borderRadius: '8px', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: '#ffffff'
          }}>
            <div style={{ 
              padding: '16px 24px', 
              borderBottom: '1px solid #f0f0f0',
              fontWeight: 'bold'
            }}>
              模型预览
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {currentBoat ? (
                <ShipScene 
                  modelConfig={{
                    id: currentBoat.ID,
                    model: { path: `${fbxBaseUrl}${currentBoat.boatEnName}/scene.gltf` }
                  }} 
                />
              ) : (
                <Empty description="请在左侧选择一个模型进行预览" />
              )}
            </div>
          </div>
        </Col>

        {/* 右侧详情与参数 */}
        <Col span={8} style={{ height: '100%' }}>
          <Card 
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, overflow: 'hidden', padding: 0, minHeight: 0 }}
          >
            <Tabs 
              defaultActiveKey="1" 
              className="admin-boat-model-tabs"
              style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
              tabBarStyle={{ paddingLeft: '24px', paddingRight: '24px', flexShrink: 0, marginBottom: 0 }}
              items={tabItems}
              // This makes the content of the active tab scrollable
              renderTabBar={(props, DefaultTabBar) => (
                <DefaultTabBar {...props} />
              )}
            />
          </Card>
        </Col>
      </Row>

      <AddBoatModal
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        onAddComplete={handleAddComplete}
        loading={isSubmitting}
      />
    </div>
  );
}