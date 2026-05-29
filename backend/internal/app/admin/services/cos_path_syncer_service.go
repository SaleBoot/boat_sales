package services

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"

	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"

	"gorm.io/gorm"
)

type CosPathSyncerService struct {
	cosPathDao *dao.SysCosPathDao
	/*
		s.pathCache = map[string]int64{
		    // 目录类型：必定以 "/" 开头，且以 "/" 结尾
		    "/models/":               1,
		    "/models/a1/":            2,
		    "/models/a1/v1/":         3,

		    // 文件类型：必定以 "/" 开头，但末尾是具体的文件名
		    "/models/a1/v1/test.onnx": 4,

		    // 另一个分支的目录
		    "/templates/":            5,
		    "/templates/html/":       6,
		}
	*/
	pathCache map[string]int64
	cacheMu   sync.RWMutex
}

func NewCosPathSyncerService(dao *dao.SysCosPathDao) *CosPathSyncerService {
	return &CosPathSyncerService{
		cosPathDao: dao,
		pathCache:  make(map[string]int64, 512),
	}
}

// SyncCosDirTree 接收从COS列出的文件列表，然后执行一次高效、原子的全量同步。
// 这个过程包括：1. 清空旧表 -> 2. 批量插入新数据 -> 3. 重建缓存。
// 它旨在替换掉逐条同步的低效循环，是全量同步功能的核心。
func (s *CosPathSyncerService) SyncCosDirTree(ctx context.Context) (int, error) {
	cosFiles, err := ListCosFiles(GetModelsCosRootPrefix())
	if err != nil {
		log.Printf("SyncCosDirTree():Error listing COS files: %v", err)
		return 0, err
	}

	// 步骤 1: 在内存中构建一个临时的、以路径为键的节点Map，用于去重。
	nodeMap := make(map[string]*models.CosPathMeta)
	for _, file := range cosFiles {
		parts := strings.Split(strings.Trim(file.Key, "/"), "/")
		for i, part := range parts {
			isLast := i == len(parts)-1
			isDir := !isLast || strings.HasSuffix(file.Key, "/")

			// 每次都从 parts 重新构建路径，更清晰且不易出错
			currentPathParts := parts[0 : i+1]
			accumulatedPath := "/" + strings.Join(currentPathParts, "/")
			if isDir {
				accumulatedPath += "/"
			}

			if _, exists := nodeMap[accumulatedPath]; !exists {
				var finalSize int64
				var cosKey *string
				if !isDir {
					finalSize = file.Size
					actualKey := file.Key
					cosKey = &actualKey
				}
				nodeMap[accumulatedPath] = &models.CosPathMeta{
					Name:   part,
					Path:   accumulatedPath,
					IsDir:  isDir,
					Size:   finalSize,
					CosKey: cosKey,
				}
			}
		}
	}

	// 步骤 2: 对所有路径进行字母排序。
	// 这是确保父目录总是在子目录之前被处理的关键技巧。
	paths := make([]string, 0, len(nodeMap))
	for path := range nodeMap {
		paths = append(paths, path)
	}
	sort.Strings(paths)

	// 步骤 3: 在单个事务中，按排序后的顺序创建所有节点，并建立父子关系。
	err = s.cosPathDao.ExecInTransaction(ctx, func(tx *gorm.DB) error {
		// 3.1. 清空旧表
		if err := tx.Where("1 = 1").Delete(&models.CosPathMeta{}).Error; err != nil {
			return fmt.Errorf("清空COS路径表失败: %w", err)
		}

		// 3.2. 循环创建，并维护路径与ID的映射关系
		pathToIdMap := make(map[string]int64)
		// 必须遍历排好序的 paths
		for _, path := range paths {
			node := nodeMap[path]

			// 寻找父ID
			parentPath := getParentPath(path)
			parentID, _ := pathToIdMap[parentPath]
			node.ParentID = parentID

			// 创建节点
			if err := tx.Create(node).Error; err != nil {
				return fmt.Errorf("创建路径 '%s' 失败: %w", path, err)
			}

			// 关键：在 Create 之后，node.ID 才会被 GORM 赋予正确的值
			// 记录新创建的ID，供其子节点使用
			pathToIdMap[path] = node.ID
		}
		return nil
	})

	if err != nil {
		return 0, fmt.Errorf("同步COS目录树事务失败: %w", err)
	}

	// 步骤 4: 在数据入库后，重建内存缓存。
	if err := s.WarmUpCache(ctx); err != nil {
		return 0, fmt.Errorf("预热COS路径缓存失败: %w", err)
	}

	log.Printf("SyncCosDirTree():ok,Synced %v nodes", len(paths))
	return len(paths), nil
}

// getParentPath 获取给定路径的父路径
func getParentPath(path string) string {
	// 移除末尾的斜杠（如果是目录）
	path = strings.TrimSuffix(path, "/")
	lastSlash := strings.LastIndex(path, "/")
	if lastSlash <= 0 { // 如果是顶级目录（如 /gltf/）或未找到斜杠
		return "/" // 约定根路径为 "/"
	}
	return path[:lastSlash+1]
}

func (s *CosPathSyncerService) WarmUpCache(ctx context.Context) error {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()

	// 清空现有缓存
	s.pathCache = make(map[string]int64, 512)

	// 从数据库加载所有路径
	allPaths, err := s.cosPathDao.FindAll(ctx)
	if err != nil {
		return err
	}

	for _, path := range allPaths {
		s.pathCache[path.Path] = path.ID
	}

	return nil
}

// SyncSinglePath 高并发安全的路径拓扑同步函数
// 场景：SyncSinglePath (增量、高并发同步)
// 目标：当一个新文件上传到 COS 时，实时、安全地将其路径信息补充到现有的数据库和缓存中。
// 环境：在它运行时，可能有成百上千个其他的文件上传操作正在同时调用 SyncSinglePath。
func (s *CosPathSyncerService) SyncSinglePath(ctx context.Context,
	aCosPath string,
	aFileSize int64) error {
	cleanedPath := strings.Trim(aCosPath, "/")
	if cleanedPath == "" {
		return nil
	}

	parts := strings.Split(cleanedPath, "/")
	var currentParentID int64 = 0
	var accumulatedPath string = ""

	for i, part := range parts {
		isLast := i == len(parts)-1

		accumulatedPath = accumulatedPath + "/" + part
		if !isLast || strings.HasSuffix(aCosPath, "/") {
			accumulatedPath += "/"
		}

		// 1. 读锁轻量级检查
		s.cacheMu.RLock()
		cachedID, exists := s.pathCache[accumulatedPath]
		s.cacheMu.RUnlock()

		if exists {
			currentParentID = cachedID
			continue
		}

		// 2. Go 内存双检锁排队，完美规避 MySQL Gap Lock 导致的死锁和并发报错
		s.cacheMu.Lock()
		if cachedID, exists = s.pathCache[accumulatedPath]; exists {
			currentParentID = cachedID
			s.cacheMu.Unlock()
			continue
		}

		isDir := !isLast
		var finalSize int64 = 0
		var cosKey *string

		if isLast {
			finalSize = aFileSize
			actualKey := aCosPath
			cosKey = &actualKey
		}

		record := &models.CosPathMeta{
			ParentID: currentParentID,
			Name:     part,
			Path:     accumulatedPath,
			IsDir:    isDir,
			Size:     finalSize,
			CosKey:   cosKey,
		}

		if err := s.cosPathDao.Create(ctx, record); err != nil {
			s.cacheMu.Unlock()
			return err
		}

		// 3. 写入内存，释放锁
		s.pathCache[accumulatedPath] = record.ID
		s.cacheMu.Unlock()

		currentParentID = record.ID
	}

	return nil
}

// GetSubNodes 毫秒级获取某一层路径下的子节点树列表（完全平替 COS ListObjects 慢查询）
func (s *CosPathSyncerService) GetSubNodes(ctx context.Context, currentPath string) (
	[]models.CosPathMeta, error) {

	if currentPath == "" || currentPath == "/" {
		currentPath = "/"
	} else {
		if !strings.HasPrefix(currentPath, "/") {
			currentPath = "/" + currentPath
		}
		if !strings.HasSuffix(currentPath, "/") {
			currentPath = currentPath + "/"
		}
	}

	var parentID int64 = 0

	if currentPath != "/" {
		s.cacheMu.RLock()
		id, exists := s.pathCache[currentPath]
		s.cacheMu.RUnlock()

		if exists {
			parentID = id
		} else {
			// 对未命中的非根路径进行安全加锁双检
			s.cacheMu.Lock()
			if id, exists = s.pathCache[currentPath]; exists {
				parentID = id
				s.cacheMu.Unlock()
			} else {
				parentNode, err := s.cosPathDao.FindByPath(ctx, currentPath)
				if err != nil {
					s.cacheMu.Unlock()
					return nil, err
				}
				if parentNode == nil {
					s.cacheMu.Unlock()
					return []models.CosPathMeta{}, nil
				}
				parentID = parentNode.ID
				s.pathCache[currentPath] = parentID
				s.cacheMu.Unlock()
			}
		}
	}

	subNodes, err := s.cosPathDao.FindSubNodes(ctx, parentID)
	return subNodes, err
}

// GetSubFiles 毫秒级获取某一层路径下的子文件列表
func (s *CosPathSyncerService) GetSubFiles(ctx context.Context,
	currentPath string) ([]models.CosPathMeta, error) {
	if currentPath == "" || currentPath == "/" {
		currentPath = "/"
	} else {
		if !strings.HasPrefix(currentPath, "/") {
			currentPath = "/" + currentPath
		}
		if !strings.HasSuffix(currentPath, "/") {
			currentPath = currentPath + "/"
		}
	}

	var parentID int64 = 0

	if currentPath != "/" {
		s.cacheMu.RLock()
		id, exists := s.pathCache[currentPath]
		s.cacheMu.RUnlock()

		if exists {
			parentID = id
		} else {
			// 对未命中的非根路径进行安全加锁双检
			s.cacheMu.Lock()
			if id, exists = s.pathCache[currentPath]; exists {
				parentID = id
				s.cacheMu.Unlock()
			} else {
				parentNode, err := s.cosPathDao.FindByPath(ctx, currentPath)
				if err != nil {
					s.cacheMu.Unlock()
					return nil, err
				}
				if parentNode == nil {
					s.cacheMu.Unlock()
					return []models.CosPathMeta{}, nil
				}
				parentID = parentNode.ID
				s.pathCache[currentPath] = parentID
				s.cacheMu.Unlock()
			}
		}
	}

	subFiles, err := s.cosPathDao.FindSubFiles(ctx, parentID)
	return subFiles, err
}

// GetAllDescendantFiles 递归获取指定路径下的所有后代文件
func (s *CosPathSyncerService) GetAllDescendantFiles(ctx context.Context, currentPath string) ([]models.CosPathMeta, error) {
	if currentPath == "" || currentPath == "/" {
		currentPath = "/"
	} else {
		if !strings.HasPrefix(currentPath, "/") {
			currentPath = "/" + currentPath
		}
		if !strings.HasSuffix(currentPath, "/") {
			currentPath = currentPath + "/"
		}
	}

	// 直接调用DAO层的新方法，使用LIKE查询来获取所有后代文件
	descendantFiles, err := s.cosPathDao.FindAllDescendantFilesByPath(ctx, currentPath)
	return descendantFiles, err
}

// GetSubDirPaths 毫秒级获取某一层路径下的子目录的路径列表
func (s *CosPathSyncerService) GetSubDirPaths(ctx context.Context,
	currentPath string) ([]string, error) {
	if currentPath == "" || currentPath == "/" {
		currentPath = "/"
	} else {
		if !strings.HasPrefix(currentPath, "/") {
			currentPath = "/" + currentPath
		}
		if !strings.HasSuffix(currentPath, "/") {
			currentPath = currentPath + "/"
		}
	}

	var parentID int64 = 0

	if currentPath != "/" {
		s.cacheMu.RLock()
		id, exists := s.pathCache[currentPath]
		s.cacheMu.RUnlock()

		if exists {
			parentID = id
		} else {
			// 对未命中的非根路径进行安全加锁双检
			s.cacheMu.Lock()
			if id, exists = s.pathCache[currentPath]; exists {
				parentID = id
				s.cacheMu.Unlock()
			} else {
				parentNode, err := s.cosPathDao.FindByPath(ctx, currentPath)
				if err != nil {
					s.cacheMu.Unlock()
					return nil, err
				}
				if parentNode == nil {
					s.cacheMu.Unlock()
					return []string{}, nil
				}
				parentID = parentNode.ID
				s.pathCache[currentPath] = parentID
				s.cacheMu.Unlock()
			}
		}
	}

	subDirs, err := s.cosPathDao.FindSubDirs(ctx, parentID)
	if err != nil {
		return nil, err
	}

	var dirNames []string
	for _, dir := range subDirs {
		dirNames = append(dirNames, dir.Path)
	}

	return dirNames, nil
}
