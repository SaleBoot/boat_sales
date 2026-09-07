package v1

import (
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

const maxUploadRequestSize = 512 << 20

type adminActionResponse struct { // old code
	Message string         `json:"message"`
	State   adminDashboard `json:"state"`
}

func (a *app) RegisterAdminRoutes(aApiRG *gin.RouterGroup) {
	// 创建管理后台路由组
	adminRG := aApiRG.Group("/admin")

	a.adminM.RegisterRoutes_noAuth(adminRG) //----------

	// videos管理 (路径自动拼接为 /api/admin/videos)
	videos := adminRG.Group("/videos")
	{
		// mux.HandleFunc("PUT /api/admin/videos/{videoID}", a.handleAdminUpdateVideo)
		videos.PUT("/:videoID", a.handleAdminUpdateVideo)
		// mux.HandleFunc("DELETE /api/admin/videos/{videoID}", a.handleAdminDeleteVideo)
		videos.DELETE("/:videoID", a.handleAdminDeleteVideo)
	}

	// 接下来的路由全部需要管理员权限
	// 自动应用中间件，不再需要手动包裹每个 handler
	adminRG.Use(a.adminM.AdminAuthMiddleware())
	{
		a.adminM.RegisterRoutes_underAuth(adminRG) //----------

		// mux.HandleFunc("POST /api/admin/videos",
		//                a.requireAdminSession(a.handleAdminCreateVideo))
		videos.POST("/", a.handleAdminCreateVideo)

		// 模型管理 (路径自动拼接为 /api/admin/models)
		models := adminRG.Group("/models")
		{
			models.GET("/overview", a.handleModelsOverview)
			models.GET("/", a.handleAdminDashboard)
			models.POST("/upload", a.handleAdminUpload)
			/*
				原生路由通常用花括号：/assets/{modelID}，Gin 使用冒号：/assets/:modelID；
				如果在 Gin 里还写 {modelID}，c.Param 是拿不到值的。
				c.Param: 针对 /user/:id 路径里的变量。URL链接类似于 http://localhost:8080/user/1024
				c.Query: 针对 /user?id=123 问号后面的变量。URL链接类似于 http://localhost:8080/user?id=1024
			*/
			// mux.HandleFunc("PUT /api/admin/models/{modelID}/content",
			//                a.requireAdminSession(a.handleAdminUpdateModelContent))
			models.PUT("/:modelID/content", a.handleAdminUpdateModelContent)
			// mux.HandleFunc("PUT /api/admin/models/{modelID}/engines",
			//                a.requireAdminSession(a.handleAdminUpdateModelEngines))
			models.PUT("/:modelID/engines", a.handleAdminUpdateModelEngines)
			// mux.HandleFunc("DELETE /api/admin/models/{modelID}",
			//                a.requireAdminSession(a.handleAdminDeleteModel))
			models.DELETE("/:modelID", a.handleAdminDeleteModel)
			// mux.HandleFunc("DELETE /api/admin/models/{modelID}/files",
			//               a.requireAdminSession(a.handleAdminDeleteFile))
			models.DELETE("/:modelID/files", a.handleAdminDeleteFile)
			// mux.HandleFunc("PUT /api/admin/models/{modelID}/files/texture-type",
			// 				 a.requireAdminSession(a.handleAdminUpdateTextureType))
			models.PUT("/:modelID/files/texture-type", a.handleAdminUpdateTextureType)
		}

		// mux.HandleFunc("PUT /api/admin/hero",
		// 				a.requireAdminSession(a.handleAdminUpdateHeroContent))
		adminRG.PUT("/hero", a.handleAdminUpdateHeroContent)
		// mux.HandleFunc("PUT /api/admin/settings",
		// 				a.requireAdminSession(a.handleAdminUpdateSiteSettings))
		adminRG.PUT("/settings", a.handleAdminUpdateSiteSettings)
		// mux.HandleFunc("POST /api/admin/file-texture-type",
		// 					a.requireAdminSession(a.handleAdminUpdateTextureType))
		adminRG.POST("/file-texture-type", a.handleAdminUpdateTextureType)
		// mux.HandleFunc("POST /api/admin/uv-set-material-hint",
		// 					a.requireAdminSession(a.handleAdminUpdateUVSetMaterialHint))
		adminRG.POST("/uv-set-material-hint", a.handleAdminUpdateUVSetMaterialHint)
		// mux.HandleFunc("POST /api/admin/sync",
		// 					a.requireAdminSession(a.handleAdminSync))
		adminRG.POST("/sync", a.handleAdminSync)
	}

}

type ModelsOverview struct {
	ModelCount    int     `json:"modelCount"`
	FileCount     int     `json:"fileCount"`
	TotalSizeInMB float64 `json:"totalSizeInMB"`
}

func (a *app) handleModelsOverview(c *gin.Context) {
	overview := ModelsOverview{ModelCount: 12, FileCount: 157, TotalSizeInMB: 447.5} // 这里应该是动态计算的统计数据，暂时写死了

	c.JSON(http.StatusOK, overview)
}

func (a *app) handleAdminDashboard(c *gin.Context) {
	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, dashboard)
}

func (a *app) handleAdminUpload(c *gin.Context) {
	r := c.Request
	r.Body = http.MaxBytesReader(c.Writer, r.Body, maxUploadRequestSize)
	if err := r.ParseMultipartForm(maxUploadRequestSize); err != nil {
		writeAPIError(c, http.StatusBadRequest, fmt.Errorf("parse upload form: %w", err))
		return
	}
	defer r.MultipartForm.RemoveAll()

	modelID, err := sanitizeModelID(r.FormValue("modelId"))
	if err != nil {
		writeAPIError(c, http.StatusBadRequest, err)
		return
	}

	subdirectory, err := sanitizeRelativeSubdirectory(r.FormValue("subdir"))
	if err != nil {
		writeAPIError(c, http.StatusBadRequest, err)
		return
	}

	replaceExisting := parseReplaceFlag(r.FormValue("replace"))
	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		writeAPIError(c, http.StatusBadRequest, errors.New("at least one file must be selected"))
		return
	}

	targetDir := resolveModelSourceDir(a.sourceDir, modelID)
	if subdirectory != "" {
		targetDir = filepath.Join(targetDir, filepath.FromSlash(subdirectory))
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		writeAPIError(c, http.StatusInternalServerError, fmt.Errorf("create upload directory: %w", err))
		return
	}

	uploadedCount := 0
	for _, header := range files {
		fileName := filepath.Base(header.Filename)
		if fileName == "." || fileName == "" {
			writeAPIError(c, http.StatusBadRequest, errors.New("invalid upload file name"))
			return
		}

		extension := strings.ToLower(filepath.Ext(fileName))
		if !isAllowedAssetExtension(extension) {
			writeAPIError(c, http.StatusBadRequest, fmt.Errorf("unsupported file type for %s", fileName))
			return
		}

		targetPath := filepath.Join(targetDir, fileName)
		if !replaceExisting {
			if _, err := os.Stat(targetPath); err == nil {
				writeAPIError(c, http.StatusConflict, fmt.Errorf("file already exists: %s", fileName))
				return
			}
		}

		if err := saveUploadedFile(header, targetPath); err != nil {
			writeAPIError(c, http.StatusInternalServerError, err)
			return
		}

		uploadedCount += 1
	}

	if _, err := os.Stat(a.focusTargetsFilePath(modelID)); err != nil {
		if os.IsNotExist(err) {
			if err := a.writeSiteModelFocusTargets(modelID, map[string]siteOrderFocusPreset{}); err != nil {
				writeAPIError(c, http.StatusInternalServerError, err)
				return
			}
		} else {
			writeAPIError(c, http.StatusInternalServerError, fmt.Errorf("inspect focus targets for %s: %w", modelID, err))
			return
		}
	}

	if _, err := a.syncAssetsLocked(); err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	message := fmt.Sprintf("Uploaded %d file(s) to %s", uploadedCount, modelID)
	if subdirectory != "" {
		message = fmt.Sprintf("%s/%s", message, subdirectory)
	}

	c.JSON(http.StatusCreated, adminActionResponse{
		Message: message,
		State:   dashboard,
	})
}

func (a *app) handleAdminDeleteModel(c *gin.Context) {
	modelID, err := sanitizeModelID(c.Param("modelID"))
	if err != nil {
		writeAPIError(c, http.StatusBadRequest, err)
		return
	}

	modelDir := resolveModelSourceDir(a.sourceDir, modelID)

	a.mu.Lock()
	defer a.mu.Unlock()

	if _, err := os.Stat(modelDir); err != nil {
		if os.IsNotExist(err) {
			writeAPIError(c, http.StatusNotFound, fmt.Errorf("model %s does not exist", modelID))
			return
		}

		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	if err := os.RemoveAll(modelDir); err != nil {
		writeAPIError(c, http.StatusInternalServerError, fmt.Errorf("delete model %s: %w", modelID, err))
		return
	}

	content, err := a.readSiteContent()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	if _, exists := content.Models[modelID]; exists {
		delete(content.Models, modelID)
		if err := a.writeSiteContent(content); err != nil {
			writeAPIError(c, http.StatusInternalServerError, err)
			return
		}
	}

	focusTargetsPath := a.focusTargetsFilePath(modelID)
	if err := os.Remove(focusTargetsPath); err != nil && !os.IsNotExist(err) {
		writeAPIError(c, http.StatusInternalServerError, fmt.Errorf("delete focus targets for %s: %w", modelID, err))
		return
	}

	if _, err := a.syncAssetsLocked(); err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, adminActionResponse{
		Message: fmt.Sprintf("Deleted model %s", modelID),
		State:   dashboard,
	})
}

func (a *app) handleAdminDeleteFile(c *gin.Context) {
	modelID, err := sanitizeModelID(c.Param("modelID"))
	if err != nil {
		writeAPIError(c, http.StatusBadRequest, err)
		return
	}

	relativePath, err := sanitizeRelativeFilePath(c.Query("path"))
	if err != nil {
		writeAPIError(c, http.StatusBadRequest, err)
		return
	}

	modelDir := resolveModelSourceDir(a.sourceDir, modelID)
	targetPath := filepath.Join(modelDir, filepath.FromSlash(relativePath))

	a.mu.Lock()
	defer a.mu.Unlock()

	if !isWithinBaseDirectory(modelDir, targetPath) {
		writeAPIError(c, http.StatusBadRequest, errors.New("file path escapes the model directory"))
		return
	}

	fileInfo, err := os.Stat(targetPath)
	if err != nil {
		if os.IsNotExist(err) {
			writeAPIError(c, http.StatusNotFound, fmt.Errorf("file does not exist: %s", relativePath))
			return
		}

		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	if fileInfo.IsDir() {
		writeAPIError(c, http.StatusBadRequest, errors.New("only files can be deleted from this endpoint"))
		return
	}

	if err := os.Remove(targetPath); err != nil {
		writeAPIError(c, http.StatusInternalServerError, fmt.Errorf("delete file %s: %w", relativePath, err))
		return
	}

	pruneEmptyDirectories(filepath.Dir(targetPath), modelDir)

	if _, err := a.syncAssetsLocked(); err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, adminActionResponse{
		Message: fmt.Sprintf("Deleted file %s from %s", relativePath, modelID),
		State:   dashboard,
	})
}

func (a *app) handleAdminSync(c *gin.Context) {
	a.mu.Lock()
	_, err := a.syncAssetsLocked()
	a.mu.Unlock()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, adminActionResponse{
		Message: "Synced source models into frontend/public/gltf",
		State:   dashboard,
	})
}

func saveUploadedFile(header *multipart.FileHeader, targetPath string) error {
	source, err := header.Open()
	if err != nil {
		return fmt.Errorf("open uploaded file %s: %w", header.Filename, err)
	}
	defer source.Close()

	target, err := os.Create(targetPath)
	if err != nil {
		return fmt.Errorf("create target file %s: %w", targetPath, err)
	}
	defer target.Close()

	if _, err := io.Copy(target, source); err != nil {
		return fmt.Errorf("save uploaded file %s: %w", header.Filename, err)
	}

	return nil
}

func parseReplaceFlag(value string) bool {
	return strings.TrimSpace(strings.ToLower(value)) != "false"
}

func sanitizeModelID(value string) (string, error) {
	candidate := strings.TrimSpace(value)
	if candidate == "" {
		return "", errors.New("modelId is required")
	}

	for _, r := range candidate {
		if r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|' {
			return "", errors.New("modelId contains unsupported path characters")
		}

		if r < 0x20 {
			return "", errors.New("modelId contains control characters")
		}

		if r == '_' || r == '-' || r == '.' || r == ' ' || r >= 0x80 || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			continue
		}

		return "", errors.New("modelId contains unsupported characters")
	}

	return candidate, nil
}

func sanitizeRelativeSubdirectory(value string) (string, error) {
	candidate := strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	if candidate == "" {
		return "", nil
	}

	if strings.HasPrefix(candidate, "/") {
		return "", errors.New("subdir must be relative")
	}

	cleaned := path.Clean(candidate)
	if cleaned == "." {
		return "", nil
	}

	if cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", errors.New("subdir may not escape the model directory")
	}

	for _, segment := range strings.Split(cleaned, "/") {
		if segment == "" {
			continue
		}

		if err := validateRelativePathSegment(segment); err != nil {
			return "", fmt.Errorf("subdir contains unsupported characters: %w", err)
		}
	}

	return cleaned, nil
}

func validateRelativePathSegment(segment string) error {
	if segment == "." || segment == ".." {
		return errors.New("relative path segment may not be dot or dot-dot")
	}

	for _, r := range segment {
		if r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|' {
			return errors.New("relative path segment contains unsupported path characters")
		}

		if r < 0x20 {
			return errors.New("relative path segment contains control characters")
		}
	}

	return nil
}

func sanitizeRelativeFilePath(value string) (string, error) {
	candidate := strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	if candidate == "" {
		return "", errors.New("file path is required")
	}

	if strings.HasPrefix(candidate, "/") {
		return "", errors.New("file path must be relative")
	}

	cleaned := path.Clean(candidate)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", errors.New("file path may not escape the model directory")
	}

	return cleaned, nil
}

func isWithinBaseDirectory(baseDir string, targetPath string) bool {
	baseAbs, err := filepath.Abs(baseDir)
	if err != nil {
		return false
	}

	targetAbs, err := filepath.Abs(targetPath)
	if err != nil {
		return false
	}

	relativePath, err := filepath.Rel(baseAbs, targetAbs)
	if err != nil {
		return false
	}

	return relativePath != ".." && !strings.HasPrefix(relativePath, ".."+string(os.PathSeparator))
}

func pruneEmptyDirectories(currentDir string, stopDir string) {
	for {
		if currentDir == stopDir {
			return
		}

		entries, err := os.ReadDir(currentDir)
		if err != nil || len(entries) > 0 {
			return
		}

		_ = os.Remove(currentDir)
		currentDir = filepath.Dir(currentDir)
	}
}
