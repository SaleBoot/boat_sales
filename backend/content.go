package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type siteFocusTargetsFile struct {
	ModelID      string                              `json:"modelId"`
	UpdatedAt    string                              `json:"updatedAt"`
	FocusTargets map[string]siteOrderFocusPreset     `json:"focusTargets"`
}

var (
	youtubeVideoIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)
	bilibiliBVIDPattern   = regexp.MustCompile(`(?i)^BV[0-9A-Za-z]+$`)
	numericIDPattern      = regexp.MustCompile(`^[0-9]+$`)
	hexColorPattern       = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
)

type siteContent struct {
	UpdatedAt string                      `json:"updatedAt"`
	Settings  siteSettings                `json:"settings"`
	Hero      siteHeroContent             `json:"hero"`
	Videos    []siteVideo                 `json:"videos"`
	Models    map[string]siteModelContent `json:"models"`
}

type siteSettings struct {
	PrimaryModelID string `json:"primaryModelId"`
	HeroImagePath  string `json:"heroImagePath"`
	BrochurePath   string `json:"brochurePath"`
	CompareLimit   int    `json:"compareLimit"`
}

type siteHeroContent struct {
	Kicker               string   `json:"kicker"`
	Heading              string   `json:"heading"`
	Summary              string   `json:"summary"`
	ProofPoints          []string `json:"proofPoints"`
	PrimaryButtonLabel   string   `json:"primaryButtonLabel"`
	SecondaryButtonLabel string   `json:"secondaryButtonLabel"`
	ScrollCueLabel       string   `json:"scrollCueLabel"`
}

type siteModelSpecs struct {
	OverallLength   string `json:"overallLength"`
	WaterlineLength string `json:"waterlineLength"`
	Beam            string `json:"beam"`
	Depth           string `json:"depth"`
	Draft           string `json:"draft"`
	NavigationArea  string `json:"navigationArea"`
	MainEnginePower string `json:"mainEnginePower"`
	DesignSpeed     string `json:"designSpeed"`
	RatedCapacity   string `json:"ratedCapacity"`
	PowerType       string `json:"powerType"`
	Material        string `json:"material"`
	CertificateType string `json:"certificateType"`
}

type siteVector3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type siteEngineMount struct {
	Enabled  bool        `json:"enabled"`
	Type     string      `json:"type"`
	Position siteVector3 `json:"position"`
	Rotation siteVector3 `json:"rotation"`
}

type siteOrderOption struct {
	ID                string                      `json:"id"`
	Label             string                      `json:"label"`
	Description       string                      `json:"description"`
	Price             int                         `json:"price"`
	YachtOnly         bool                        `json:"yachtOnly,omitempty"`
	FocusTarget       string                      `json:"focusTarget,omitempty"`
	MaterialOverrides []siteOrderMaterialOverride `json:"materialOverrides,omitempty"`
}

type siteOrderMaterialOverride struct {
	MaterialSlots      []string `json:"materialSlots,omitempty"`
	BaseColorPath      string   `json:"baseColorPath,omitempty"`
}

type siteOrderColorOption struct {
	ID            string   `json:"id"`
	Label         string   `json:"label"`
	Hex           string   `json:"hex"`
	Surcharge     int      `json:"surcharge"`
	MaterialSlots []string `json:"materialSlots,omitempty"`
}

type siteOrderFocusPreset struct {
	Zoom       float64     `json:"zoom"`
	Target     siteVector3 `json:"target"`
	Rotation   siteVector3 `json:"rotation"`
	CameraMode string      `json:"cameraMode,omitempty"`
}

type siteOrderConfig struct {
	AppearanceOptions     []siteOrderOption               `json:"appearanceOptions"`
	ColorOptions          []siteOrderColorOption          `json:"colorOptions"`
	InteriorOptions       []siteOrderOption               `json:"interiorOptions"`
	PowerOptions          []siteOrderOption               `json:"powerOptions"`
	OptionalSeriesOptions []siteOrderOption               `json:"optionalSeriesOptions"`
	FocusTargets          map[string]siteOrderFocusPreset `json:"focusTargets"`
}

var standardSiteOrderFocusTargets = []struct {
	Key string
}{
	{Key: "exterior"},
	{Key: "interior"},
	{Key: "engine"},
	{Key: "console"},
	{Key: "smart-system"},
	{Key: "POINT1"},
	{Key: "POINT2"},
	{Key: "POINT3"},
	{Key: "POINT4"},
	{Key: "POINT5"},
}

var siteOrderFocusTargetAliases = map[string]string{
	"overview":    "exterior",
	"smartSystem": "smart-system",
	"内部":          "interior",
	"外部":          "exterior",
	"发动机":         "engine",
	"中控台":         "console",
	"智能系统":        "smart-system",
}

type siteRenderConfig map[string]any

type siteModelContent struct {
	DisplayName       string            `json:"displayName"`
	Type              string            `json:"type"`
	Price             string            `json:"price"`
	SelectedModelPath string            `json:"selectedModelPath,omitempty"`
	Specs             siteModelSpecs    `json:"specs"`
	Engines           []siteEngineMount `json:"engines,omitempty"`
	OrderConfig       siteOrderConfig   `json:"orderConfig"`
	RenderConfig      siteRenderConfig  `json:"renderConfig,omitempty"`
	DetailImagePath   string            `json:"detailImagePath"`
	Summary           string            `json:"summary"`
}

type siteVideo struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Summary     string `json:"summary"`
	Platform    string `json:"platform"`
	SourceURL   string `json:"sourceUrl"`
	ExternalURL string `json:"externalUrl"`
	EmbedURL    string `json:"embedUrl"`
}

type siteVideoInput struct {
	Title   string `json:"title"`
	Summary string `json:"summary"`
	URL     string `json:"url"`
}

type siteModelContentInput struct {
	DisplayName       string            `json:"displayName"`
	Type              string            `json:"type"`
	Price             string            `json:"price"`
	SelectedModelPath string            `json:"selectedModelPath"`
	Specs             siteModelSpecs    `json:"specs"`
	Engines           []siteEngineMount `json:"engines"`
	OrderConfig       siteOrderConfig   `json:"orderConfig"`
	RenderConfig      siteRenderConfig  `json:"renderConfig"`
	DetailImagePath   string            `json:"detailImagePath"`
	Summary           string            `json:"summary"`
}

type siteModelEnginesInput struct {
	Engines []siteEngineMount `json:"engines"`
}

type siteHeroContentInput struct {
	Kicker               string   `json:"kicker"`
	Heading              string   `json:"heading"`
	Summary              string   `json:"summary"`
	ProofPoints          []string `json:"proofPoints"`
	PrimaryButtonLabel   string   `json:"primaryButtonLabel"`
	SecondaryButtonLabel string   `json:"secondaryButtonLabel"`
	ScrollCueLabel       string   `json:"scrollCueLabel"`
}

type siteSettingsInput struct {
	PrimaryModelID string `json:"primaryModelId"`
	HeroImagePath  string `json:"heroImagePath"`
	BrochurePath   string `json:"brochurePath"`
	CompareLimit   int    `json:"compareLimit"`
}

const maxSiteEngineMountCount = 4
const maxSiteHeroProofPointCount = 3
const defaultSiteCompareLimit = 4

func (a *app) registerContentRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/site-content", a.handleSiteContent)
	mux.HandleFunc("GET /api/models/{modelID}/focus-targets", a.handleModelFocusTargets)
}

func (a *app) handleSiteContent(w http.ResponseWriter, r *http.Request) {
	content, err := a.readSiteContent()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, content)
}

func (a *app) handleModelFocusTargets(w http.ResponseWriter, r *http.Request) {
	modelID, err := sanitizeModelID(r.PathValue("modelID"))
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	content, err := a.readSiteContent()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	modelContent := content.Models[modelID]
	focusTargets := a.resolveSiteModelFocusTargets(modelID, modelContent.OrderConfig.FocusTargets)
	writeJSON(w, http.StatusOK, map[string]any{
		"modelId": modelID,
		"focusTargets": focusTargets,
	})
}

func (a *app) handleAdminUpdateModelContent(w http.ResponseWriter, r *http.Request) {
	modelID, err := sanitizeModelID(r.PathValue("modelID"))
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	input, err := decodeSiteModelContentInput(r)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	modelDir := resolveModelSourceDir(a.sourceDir, modelID)
	if _, err := os.Stat(modelDir); err != nil {
		if os.IsNotExist(err) {
			writeAPIError(w, http.StatusNotFound, fmt.Errorf("model %s does not exist", modelID))
			return
		}

		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	content, err := a.readSiteContent()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	nextContent := siteModelContent{
		DisplayName:       strings.TrimSpace(input.DisplayName),
		Type:              normalizeModelType(input.Type),
		Price:             "",
		SelectedModelPath: "",
		Specs:             normalizeSiteModelSpecs(input.Specs),
		Engines:           normalizeSiteEngineMounts(input.Engines),
		OrderConfig:       normalizeSiteOrderConfig(input.OrderConfig),
		RenderConfig:      normalizeSiteRenderConfig(input.RenderConfig),
		Summary:           strings.TrimSpace(input.Summary),
	}

	price, err := normalizeSiteModelPrice(input.Price)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}
	nextContent.Price = price

	selectedModelPath, err := normalizeSiteModelSelectedModelPath(a.sourceDir, modelID, input.SelectedModelPath)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}
	nextContent.SelectedModelPath = selectedModelPath

	detailImagePath, err := normalizeSiteModelDetailImagePath(a.sourceDir, modelID, input.DetailImagePath)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}
	nextContent.DetailImagePath = detailImagePath

	if !hasAnySiteModelContent(nextContent) {
		delete(content.Models, modelID)
	} else {
		content.Models[modelID] = nextContent
	}

	if err := a.writeSiteContent(content); err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, adminActionResponse{
		Message: fmt.Sprintf("Updated content for model %s", modelID),
		State:   dashboard,
	})
}

func (a *app) handleAdminUpdateModelEngines(w http.ResponseWriter, r *http.Request) {
	modelID, err := sanitizeModelID(r.PathValue("modelID"))
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	var input siteModelEnginesInput
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeAPIError(w, http.StatusBadRequest, fmt.Errorf("decode request body: %w", err))
		return
	}

	modelDir := resolveModelSourceDir(a.sourceDir, modelID)
	if _, err := os.Stat(modelDir); err != nil {
		if os.IsNotExist(err) {
			writeAPIError(w, http.StatusNotFound, fmt.Errorf("model %s does not exist", modelID))
			return
		}

		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	if err := a.updateSiteModelEngines(modelID, input.Engines); err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, adminActionResponse{
		Message: fmt.Sprintf("Updated engine mounts for model %s", modelID),
		State:   dashboard,
	})
}

func (a *app) handleAdminUpdateHeroContent(w http.ResponseWriter, r *http.Request) {
	var input siteHeroContentInput
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeAPIError(w, http.StatusBadRequest, fmt.Errorf("decode request body: %w", err))
		return
	}

	if err := a.updateSiteHeroContent(input); err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, adminActionResponse{
		Message: "Updated hero content",
		State:   dashboard,
	})
}

func (a *app) handleAdminUpdateSiteSettings(w http.ResponseWriter, r *http.Request) {
	var input siteSettingsInput
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeAPIError(w, http.StatusBadRequest, fmt.Errorf("decode request body: %w", err))
		return
	}

	if err := a.updateSiteSettings(input); err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	a.mu.Lock()
	_, syncErr := a.syncAssetsLocked()
	a.mu.Unlock()
	if syncErr != nil {
		writeAPIError(w, http.StatusInternalServerError, syncErr)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, adminActionResponse{
		Message: "Updated site settings",
		State:   dashboard,
	})
}

func (a *app) updateSiteModelEngines(modelID string, engines []siteEngineMount) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	content, err := a.readSiteContent()
	if err != nil {
		return err
	}

	nextContent := content.Models[modelID]
	nextContent.Engines = normalizeSiteEngineMounts(engines)

	if !hasAnySiteModelContent(nextContent) {
		delete(content.Models, modelID)
	} else {
		content.Models[modelID] = nextContent
	}

	return a.writeSiteContent(content)
}

func (a *app) updateSiteSettings(input siteSettingsInput) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	content, err := a.readSiteContent()
	if err != nil {
		return err
	}

	settings, err := normalizeSiteSettings(a.sourceDir, siteSettings{
		PrimaryModelID: input.PrimaryModelID,
		HeroImagePath:  input.HeroImagePath,
		BrochurePath:   input.BrochurePath,
		CompareLimit:   input.CompareLimit,
	})
	if err != nil {
		return err
	}

	content.Settings = settings
	return a.writeSiteContent(content)
}

func (a *app) updateSiteHeroContent(input siteHeroContentInput) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	content, err := a.readSiteContent()
	if err != nil {
		return err
	}

	content.Hero = normalizeSiteHeroContent(siteHeroContent{
		Kicker:               input.Kicker,
		Heading:              input.Heading,
		Summary:              input.Summary,
		ProofPoints:          input.ProofPoints,
		PrimaryButtonLabel:   input.PrimaryButtonLabel,
		SecondaryButtonLabel: input.SecondaryButtonLabel,
		ScrollCueLabel:       input.ScrollCueLabel,
	})

	return a.writeSiteContent(content)
}

func (a *app) handleAdminCreateVideo(w http.ResponseWriter, r *http.Request) {
	input, err := decodeSiteVideoInput(r)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	video, err := buildSiteVideo("", input)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	content, err := a.readSiteContent()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	content.Videos = append(content.Videos, video)
	if err := a.writeSiteContent(content); err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusCreated, adminActionResponse{
		Message: fmt.Sprintf("Added %s video \"%s\"", displayPlatformName(video.Platform), video.Title),
		State:   dashboard,
	})
}

func (a *app) handleAdminUpdateVideo(w http.ResponseWriter, r *http.Request) {
	videoID := strings.TrimSpace(r.PathValue("videoID"))
	if videoID == "" {
		writeAPIError(w, http.StatusBadRequest, errors.New("videoID is required"))
		return
	}

	input, err := decodeSiteVideoInput(r)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	content, err := a.readSiteContent()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	index := findSiteVideoIndex(content.Videos, videoID)
	if index == -1 {
		writeAPIError(w, http.StatusNotFound, fmt.Errorf("video %s does not exist", videoID))
		return
	}

	video, err := buildSiteVideo(videoID, input)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	content.Videos[index] = video
	if err := a.writeSiteContent(content); err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, adminActionResponse{
		Message: fmt.Sprintf("Updated %s video \"%s\"", displayPlatformName(video.Platform), video.Title),
		State:   dashboard,
	})
}

func (a *app) handleAdminDeleteVideo(w http.ResponseWriter, r *http.Request) {
	videoID := strings.TrimSpace(r.PathValue("videoID"))
	if videoID == "" {
		writeAPIError(w, http.StatusBadRequest, errors.New("videoID is required"))
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	content, err := a.readSiteContent()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	index := findSiteVideoIndex(content.Videos, videoID)
	if index == -1 {
		writeAPIError(w, http.StatusNotFound, fmt.Errorf("video %s does not exist", videoID))
		return
	}

	deletedVideo := content.Videos[index]
	content.Videos = append(content.Videos[:index], content.Videos[index+1:]...)
	if err := a.writeSiteContent(content); err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	dashboard, err := a.buildDashboard()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, adminActionResponse{
		Message: fmt.Sprintf("Deleted video \"%s\"", deletedVideo.Title),
		State:   dashboard,
	})
}

func (a *app) readSiteContent() (siteContent, error) {
	data, err := os.ReadFile(a.contentPath)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultSiteContent(), nil
		}

		return siteContent{}, fmt.Errorf("read site content: %w", err)
	}

	var content siteContent
	if err := json.Unmarshal(data, &content); err != nil {
		return siteContent{}, fmt.Errorf("parse site content: %w", err)
	}

	if content.Videos == nil {
		content.Videos = []siteVideo{}
	}

	settings, err := normalizeSiteSettings(a.sourceDir, content.Settings)
	if err != nil {
		return siteContent{}, err
	}
	content.Settings = settings

	if isEmptySiteHeroContent(content.Hero) {
		content.Hero = defaultSiteHeroContent()
	} else {
		content.Hero = normalizeSiteHeroContent(content.Hero)
	}

	if content.Models == nil {
		content.Models = map[string]siteModelContent{}
	}

	for modelID, modelContent := range content.Models {
		selectedModelPath, err := normalizeSiteModelSelectedModelPath(a.sourceDir, modelID, modelContent.SelectedModelPath)
		if err != nil {
			selectedModelPath = ""
		}
		modelContent.SelectedModelPath = selectedModelPath
		modelContent.Engines = normalizeSiteEngineMounts(modelContent.Engines)
		modelContent.OrderConfig = normalizeSiteOrderConfig(modelContent.OrderConfig)
		modelContent.OrderConfig.FocusTargets = a.resolveSiteModelFocusTargets(modelID, modelContent.OrderConfig.FocusTargets)
		modelContent.RenderConfig = normalizeSiteRenderConfig(modelContent.RenderConfig)
		content.Models[modelID] = modelContent
	}

	return content, nil
}

func (a *app) writeSiteContent(content siteContent) error {
	content.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	settings, err := normalizeSiteSettings(a.sourceDir, content.Settings)
	if err != nil {
		return err
	}
	content.Settings = settings

	if content.Videos == nil {
		content.Videos = []siteVideo{}
	}

	if content.Models == nil {
		content.Models = map[string]siteModelContent{}
	}

	for modelID, modelContent := range content.Models {
		if err := a.writeSiteModelFocusTargets(modelID, modelContent.OrderConfig.FocusTargets); err != nil {
			return err
		}
		modelContent.OrderConfig.FocusTargets = map[string]siteOrderFocusPreset{}
		content.Models[modelID] = modelContent
	}

	if err := os.MkdirAll(filepath.Dir(a.contentPath), 0o755); err != nil {
		return fmt.Errorf("create content directory: %w", err)
	}

	data, err := json.MarshalIndent(content, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal site content: %w", err)
	}

	if err := os.WriteFile(a.contentPath, append(data, '\n'), 0o644); err != nil {
		return fmt.Errorf("write site content: %w", err)
	}

	return nil
}

func (a *app) resolveSiteModelFocusTargets(modelID string, inlineFocusTargets map[string]siteOrderFocusPreset) map[string]siteOrderFocusPreset {
	fileFocusTargets, err := a.readSiteModelFocusTargets(modelID)
	if err == nil && len(fileFocusTargets) > 0 {
		return normalizeSiteOrderFocusTargets(fileFocusTargets)
	}

	return normalizeSiteOrderFocusTargets(inlineFocusTargets)
}

func (a *app) focusTargetsFilePath(modelID string) string {
	return filepath.Join(a.focusTargetsDir, fmt.Sprintf("%s.json", modelID))
}

func (a *app) readSiteModelFocusTargets(modelID string) (map[string]siteOrderFocusPreset, error) {
	filePath := a.focusTargetsFilePath(modelID)
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, err
		}

		return nil, fmt.Errorf("read focus targets for %s: %w", modelID, err)
	}

	var file siteFocusTargetsFile
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, fmt.Errorf("parse focus targets for %s: %w", modelID, err)
	}

	return normalizeSiteOrderFocusTargets(file.FocusTargets), nil
}

func (a *app) writeSiteModelFocusTargets(modelID string, focusTargets map[string]siteOrderFocusPreset) error {
	normalizedFocusTargets := normalizeSiteOrderFocusTargets(focusTargets)
	if err := os.MkdirAll(a.focusTargetsDir, 0o755); err != nil {
		return fmt.Errorf("create focus targets directory: %w", err)
	}

	filePath := a.focusTargetsFilePath(modelID)
	file := siteFocusTargetsFile{
		ModelID:      modelID,
		UpdatedAt:    time.Now().UTC().Format(time.RFC3339),
		FocusTargets: normalizedFocusTargets,
	}

	data, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal focus targets for %s: %w", modelID, err)
	}

	if err := os.WriteFile(filePath, append(data, '\n'), 0o644); err != nil {
		return fmt.Errorf("write focus targets for %s: %w", modelID, err)
	}

	return nil
}

func defaultSiteContent() siteContent {
	return siteContent{
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		Settings:  defaultSiteSettings(),
		Hero:      defaultSiteHeroContent(),
		Videos:    []siteVideo{},
		Models:    map[string]siteModelContent{},
	}
}

func defaultSiteSettings() siteSettings {
	return siteSettings{
		PrimaryModelID: "",
		HeroImagePath:  "pdf/FrontPage.png",
		BrochurePath:   "pdf/2026京穗船舶产品宣传册.pdf",
		CompareLimit:   defaultSiteCompareLimit,
	}
}

func defaultSiteOrderConfig() siteOrderConfig {
	return normalizeSiteOrderConfig(siteOrderConfig{
		AppearanceOptions:     []siteOrderOption{},
		ColorOptions:          []siteOrderColorOption{},
		InteriorOptions:       []siteOrderOption{},
		PowerOptions:          []siteOrderOption{},
		OptionalSeriesOptions: []siteOrderOption{},
		FocusTargets:          map[string]siteOrderFocusPreset{},
	})

	return normalizeSiteOrderConfig(siteOrderConfig{
		AppearanceOptions: []siteOrderOption{
			{
				ID:          "business",
				Label:       "商务接待外观",
				Description: "以干净比例和稳重识别为主，适合展示、接待与日常运营",
				Price:       0,
			},
			{
				ID:          "sport",
				Label:       "动感识别外观",
				Description: "强化速度感与视觉记忆点，适合品牌展示和高曝光场景",
				Price:       12000,
			},
			{
				ID:          "duty",
				Label:       "公务执法外观",
				Description: "突出任务属性和远距离识别度，适合巡航、执法与应急联动",
				Price:       18000,
			},
		},
		ColorOptions: []siteOrderColorOption{},
		InteriorOptions: []siteOrderOption{
			{
				ID:          "marine-gray",
				Label:       "海舱灰功能内饰",
				Description: "克制、耐看、易维护，适合商务接待与现代化工作船",
				Price:       0,
			},
			{
				ID:          "warm-teak",
				Label:       "暖木游艇内饰",
				Description: "突出木饰面、软包与温暖氛围，适合游艇休闲和高端接待",
				Price:       26000,
			},
			{
				ID:          "task-black",
				Label:       "任务黑耐用内饰",
				Description: "强调耐磨、抗污和设备集成，适合执法、救援与高强度任务",
				Price:       18000,
			},
		},
		PowerOptions: []siteOrderOption{
			{
				ID:          "dual-electric-standard",
				Label:       "高效巡航动力",
				Description: "兼顾静音巡航、日常接待与中短途运营，适合作为标准交付方案",
				Price:       368000,
			},
			{
				ID:          "dual-electric-performance",
				Label:       "高性能任务动力",
				Description: "提升加速响应与连续航行稳定性，适合高频使用与更复杂水域",
				Price:       428000,
			},
			{
				ID:          "hybrid-rescue",
				Label:       "混动应急动力",
				Description: "面向救援、巡逻与长时间值守任务，兼顾续航与负载能力",
				Price:       468000,
			},
		},
		OptionalSeriesOptions: []siteOrderOption{},
		FocusTargets:          map[string]siteOrderFocusPreset{},
	})
}

func decodeSiteVideoInput(r *http.Request) (siteVideoInput, error) {
	var input siteVideoInput
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		return siteVideoInput{}, fmt.Errorf("decode request body: %w", err)
	}

	return input, nil
}

func decodeSiteModelContentInput(r *http.Request) (siteModelContentInput, error) {
	var payload map[string]json.RawMessage
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&payload); err != nil {
		return siteModelContentInput{}, fmt.Errorf("decode request body: %w", err)
	}

	allowedFields := map[string]struct{}{
		"displayName":       {},
		"type":              {},
		"price":             {},
		"selectedModelPath": {},
		"specs":             {},
		"engines":           {},
		"orderConfig":       {},
		"renderConfig":      {},
		"detailImagePath":   {},
		"summary":           {},
	}

	for field := range payload {
		if _, ok := allowedFields[field]; !ok {
			return siteModelContentInput{}, fmt.Errorf("decode request body: json: unknown field %q", field)
		}
	}

	var input siteModelContentInput
	if err := decodeSiteModelContentField(payload, "displayName", &input.DisplayName); err != nil {
		return siteModelContentInput{}, err
	}
	if err := decodeSiteModelContentField(payload, "type", &input.Type); err != nil {
		return siteModelContentInput{}, err
	}
	if err := decodeSiteModelContentField(payload, "price", &input.Price); err != nil {
		return siteModelContentInput{}, err
	}
	if err := decodeSiteModelContentField(payload, "selectedModelPath", &input.SelectedModelPath); err != nil {
		return siteModelContentInput{}, err
	}
	if err := decodeSiteModelContentField(payload, "specs", &input.Specs); err != nil {
		return siteModelContentInput{}, err
	}
	if err := decodeSiteModelContentField(payload, "engines", &input.Engines); err != nil {
		return siteModelContentInput{}, err
	}
	if err := decodeSiteModelContentField(payload, "orderConfig", &input.OrderConfig); err != nil {
		return siteModelContentInput{}, err
	}
	if err := decodeSiteModelContentField(payload, "renderConfig", &input.RenderConfig); err != nil {
		return siteModelContentInput{}, err
	}
	if err := decodeSiteModelContentField(payload, "detailImagePath", &input.DetailImagePath); err != nil {
		return siteModelContentInput{}, err
	}
	if err := decodeSiteModelContentField(payload, "summary", &input.Summary); err != nil {
		return siteModelContentInput{}, err
	}

	if strings.TrimSpace(input.Type) != "" && normalizeModelType(input.Type) == "" {
		return siteModelContentInput{}, errors.New("type must be one of 新能源船、应急救援船、公务执法艇、游艇")
	}

	return input, nil
}

func decodeSiteModelContentField(payload map[string]json.RawMessage, field string, destination any) error {
	rawValue, ok := payload[field]
	if !ok {
		return nil
	}

	if err := json.Unmarshal(rawValue, destination); err != nil {
		return fmt.Errorf("decode request body: field %q: %w", field, err)
	}

	return nil
}

func normalizeSiteModelSpecs(specs siteModelSpecs) siteModelSpecs {
	return siteModelSpecs{
		OverallLength:   strings.TrimSpace(specs.OverallLength),
		WaterlineLength: strings.TrimSpace(specs.WaterlineLength),
		Beam:            strings.TrimSpace(specs.Beam),
		Depth:           strings.TrimSpace(specs.Depth),
		Draft:           strings.TrimSpace(specs.Draft),
		NavigationArea:  strings.TrimSpace(specs.NavigationArea),
		MainEnginePower: strings.TrimSpace(specs.MainEnginePower),
		DesignSpeed:     strings.TrimSpace(specs.DesignSpeed),
		RatedCapacity:   strings.TrimSpace(specs.RatedCapacity),
		PowerType:       strings.TrimSpace(specs.PowerType),
		Material:        strings.TrimSpace(specs.Material),
		CertificateType: strings.TrimSpace(specs.CertificateType),
	}
}

func normalizeSiteOrderConfig(config siteOrderConfig) siteOrderConfig {
	return siteOrderConfig{
		AppearanceOptions:     normalizeSiteOrderOptions(config.AppearanceOptions),
		ColorOptions:          normalizeSiteOrderColorOptions(config.ColorOptions),
		InteriorOptions:       normalizeSiteOrderOptions(config.InteriorOptions),
		PowerOptions:          normalizeSiteOrderOptions(config.PowerOptions),
		OptionalSeriesOptions: normalizeSiteOrderOptions(config.OptionalSeriesOptions),
		FocusTargets:          normalizeSiteOrderFocusTargets(config.FocusTargets),
	}
}

func normalizeSiteRenderConfig(config siteRenderConfig) siteRenderConfig {
	if len(config) == 0 {
		return siteRenderConfig{}
	}

	normalized := make(siteRenderConfig, len(config))
	for key, value := range config {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			continue
		}

		normalized[trimmedKey] = value
	}

	return normalized
}

func normalizeSiteOrderOptions(options []siteOrderOption) []siteOrderOption {
	if len(options) == 0 {
		return []siteOrderOption{}
	}

	normalized := make([]siteOrderOption, 0, len(options))
	for index, option := range options {
		label := strings.TrimSpace(option.Label)
		if label == "" {
			continue
		}

		id := strings.TrimSpace(option.ID)
		if id == "" {
			id = fmt.Sprintf("option-%d", index+1)
		}

		normalized = append(normalized, siteOrderOption{
			ID:                id,
			Label:             label,
			Description:       strings.TrimSpace(option.Description),
			Price:             max(0, option.Price),
			YachtOnly:         option.YachtOnly,
			FocusTarget:       strings.TrimSpace(option.FocusTarget),
			MaterialOverrides: normalizeSiteOrderMaterialOverrides(option.MaterialOverrides),
		})
	}

	return normalized
}

func normalizeSiteOrderMaterialOverrides(overrides []siteOrderMaterialOverride) []siteOrderMaterialOverride {
	if len(overrides) == 0 {
		return []siteOrderMaterialOverride{}
	}

	normalized := make([]siteOrderMaterialOverride, 0, len(overrides))
	for _, override := range overrides {
		materialSlots := make([]string, 0, len(override.MaterialSlots))
		seenMaterialSlots := map[string]bool{}
		for _, materialSlot := range override.MaterialSlots {
			normalizedSlot := strings.TrimSpace(materialSlot)
			if normalizedSlot == "" || seenMaterialSlots[normalizedSlot] {
				continue
			}

			seenMaterialSlots[normalizedSlot] = true
			materialSlots = append(materialSlots, normalizedSlot)
		}

		baseColorPath := strings.TrimSpace(override.BaseColorPath)
		if baseColorPath != "" {
			baseColorPath = strings.TrimPrefix(strings.ReplaceAll(baseColorPath, "\\", "/"), "/")
			if strings.Contains(baseColorPath, "..") {
				baseColorPath = ""
			}
		}

		if len(materialSlots) == 0 || baseColorPath == "" {
			continue
		}

		normalized = append(normalized, siteOrderMaterialOverride{
			MaterialSlots: materialSlots,
			BaseColorPath: baseColorPath,
		})
	}

	return normalized
}

func normalizeSiteOrderColorOptions(options []siteOrderColorOption) []siteOrderColorOption {
	if len(options) == 0 {
		return []siteOrderColorOption{}
	}

	normalized := make([]siteOrderColorOption, 0, len(options))
	for index, option := range options {
		label := strings.TrimSpace(option.Label)
		hexColor := strings.TrimSpace(option.Hex)
		if label == "" || hexColor == "" {
			continue
		}

		if !hexColorPattern.MatchString(hexColor) {
			continue
		}

		id := strings.TrimSpace(option.ID)
		if id == "" {
			id = fmt.Sprintf("color-%d", index+1)
		}

		materialSlots := make([]string, 0, len(option.MaterialSlots))
		seenMaterialSlots := map[string]bool{}
		for _, materialSlot := range option.MaterialSlots {
			normalizedSlot := strings.TrimSpace(materialSlot)
			if normalizedSlot == "" || seenMaterialSlots[normalizedSlot] {
				continue
			}

			seenMaterialSlots[normalizedSlot] = true
			materialSlots = append(materialSlots, normalizedSlot)
		}

		normalized = append(normalized, siteOrderColorOption{
			ID:            id,
			Label:         label,
			Hex:           hexColor,
			Surcharge:     max(0, option.Surcharge),
			MaterialSlots: materialSlots,
		})
	}

	return normalized
}

func normalizeSiteOrderFocusTargets(focusTargets map[string]siteOrderFocusPreset) map[string]siteOrderFocusPreset {
	normalized := make(map[string]siteOrderFocusPreset, len(standardSiteOrderFocusTargets))
	for key, preset := range focusTargets {
		normalizedKey := strings.TrimSpace(key)
		if normalizedKey == "" {
			continue
		}
		if aliasKey, ok := siteOrderFocusTargetAliases[normalizedKey]; ok {
			normalizedKey = aliasKey
		}

		zoom := preset.Zoom
		if zoom <= 0 {
			zoom = 7
		}

		normalized[normalizedKey] = siteOrderFocusPreset{
			Zoom:       zoom,
			Target:     normalizeSiteVector3(preset.Target),
			Rotation:   normalizeSiteVector3(preset.Rotation),
			CameraMode: normalizeSiteFocusCameraMode(preset.CameraMode, normalizedKey),
		}
	}

	for _, target := range standardSiteOrderFocusTargets {
		if _, ok := normalized[target.Key]; ok {
			continue
		}

		normalized[target.Key] = defaultSiteOrderFocusPreset(target.Key)
	}

	return normalized
}

func defaultSiteOrderFocusPreset(focusKey string) siteOrderFocusPreset {
	return siteOrderFocusPreset{
		Zoom:       7,
		Target:     siteVector3{X: 0, Y: 0.7, Z: 0},
		Rotation:   siteVector3{},
		CameraMode: normalizeSiteFocusCameraMode("", focusKey),
	}
}

func normalizeSiteFocusCameraMode(value string, focusKey string) string {
	trimmedValue := strings.TrimSpace(value)
	switch strings.ToLower(trimmedValue) {
	case "first-person", "firstperson", "fps", "第一人称":
		return "first-person"
	case "orbit", "around", "环视":
		return "orbit"
	}

	if trimmedValue == "" && focusKey == "interior" {
		return "first-person"
	}

	return "orbit"
}

func normalizeSiteEngineType(value string) string {
	switch strings.TrimSpace(value) {
	case "", "outboard-a":
		return "outboard-a"
	case "outboard-b":
		return "outboard-b"
	case "electric-outboard":
		return "electric-outboard"
	default:
		return ""
	}
}

func normalizeSiteVector3(value siteVector3) siteVector3 {
	return siteVector3{
		X: value.X,
		Y: value.Y,
		Z: value.Z,
	}
}

func normalizeSiteEngineMounts(engines []siteEngineMount) []siteEngineMount {
	if len(engines) == 0 {
		return nil
	}

	limit := len(engines)
	if limit > maxSiteEngineMountCount {
		limit = maxSiteEngineMountCount
	}

	normalized := make([]siteEngineMount, 0, limit)
	for index, engine := range engines {
		if index >= maxSiteEngineMountCount {
			break
		}

		normalized = append(normalized, siteEngineMount{
			Enabled:  engine.Enabled,
			Type:     normalizeSiteEngineType(engine.Type),
			Position: normalizeSiteVector3(engine.Position),
			Rotation: normalizeSiteVector3(engine.Rotation),
		})
	}

	return normalized
}

func defaultSiteHeroContent() siteHeroContent {
	return siteHeroContent{
		Kicker:               "京穗船舶 · 智能船型选购体验",
		Heading:              "为您找到更适合任务需求的船型方案。",
		Summary:              "从新能源船、应急救援船、公务执法艇到游艇，您可以通过 3D 沉浸式看船、查看核心参数与选装方案，更直观地了解产品，更从容地做出选择。",
		ProofPoints:          []string{"沉浸式 3D 看船", "关键参数一目了然", "专属方案快速沟通"},
		PrimaryButtonLabel:   "立即看船",
		SecondaryButtonLabel: "获取专属方案",
		ScrollCueLabel:       "继续了解",
	}
}

func normalizeSiteHeroContent(content siteHeroContent) siteHeroContent {
	proofPoints := make([]string, 0, maxSiteHeroProofPointCount)
	for _, proofPoint := range content.ProofPoints {
		trimmed := strings.TrimSpace(proofPoint)
		if trimmed == "" {
			continue
		}

		proofPoints = append(proofPoints, trimmed)
		if len(proofPoints) >= maxSiteHeroProofPointCount {
			break
		}
	}

	return siteHeroContent{
		Kicker:               strings.TrimSpace(content.Kicker),
		Heading:              strings.TrimSpace(content.Heading),
		Summary:              strings.TrimSpace(content.Summary),
		ProofPoints:          proofPoints,
		PrimaryButtonLabel:   strings.TrimSpace(content.PrimaryButtonLabel),
		SecondaryButtonLabel: strings.TrimSpace(content.SecondaryButtonLabel),
		ScrollCueLabel:       strings.TrimSpace(content.ScrollCueLabel),
	}
}

func isEmptySiteHeroContent(content siteHeroContent) bool {
	return strings.TrimSpace(content.Kicker) == "" &&
		strings.TrimSpace(content.Heading) == "" &&
		strings.TrimSpace(content.Summary) == "" &&
		strings.TrimSpace(content.PrimaryButtonLabel) == "" &&
		strings.TrimSpace(content.SecondaryButtonLabel) == "" &&
		strings.TrimSpace(content.ScrollCueLabel) == "" &&
		len(normalizeSiteHeroContent(content).ProofPoints) == 0
}

func normalizeSiteModelPrice(value string) (string, error) {
	candidate := strings.TrimSpace(value)
	if candidate == "" {
		return "", nil
	}

	candidate = strings.NewReplacer("￥", "", "¥", "", "，", "", ",", "", " ", "").Replace(candidate)
	amount, err := strconv.ParseFloat(candidate, 64)
	if err != nil {
		return "", errors.New("price must be a valid number")
	}

	return strconv.FormatFloat(amount, 'f', -1, 64), nil
}

func normalizeSiteSettings(sourceDir string, settings siteSettings) (siteSettings, error) {
	defaults := defaultSiteSettings()
	normalized := siteSettings{
		PrimaryModelID: strings.TrimSpace(settings.PrimaryModelID),
		CompareLimit:   settings.CompareLimit,
	}

	if normalized.CompareLimit <= 0 {
		normalized.CompareLimit = defaults.CompareLimit
	}
	if normalized.CompareLimit > 4 {
		normalized.CompareLimit = 4
	}

	heroImagePath, err := normalizeSiteStaticAssetPath(settings.HeroImagePath, defaults.HeroImagePath)
	if err != nil {
		return siteSettings{}, fmt.Errorf("hero image path: %w", err)
	}
	normalized.HeroImagePath = heroImagePath

	brochurePath, err := normalizeSiteStaticAssetPath(settings.BrochurePath, defaults.BrochurePath)
	if err != nil {
		return siteSettings{}, fmt.Errorf("brochure path: %w", err)
	}
	normalized.BrochurePath = brochurePath

	if normalized.PrimaryModelID != "" {
		modelID, err := sanitizeModelID(normalized.PrimaryModelID)
		if err != nil {
			return siteSettings{}, fmt.Errorf("primary model id: %w", err)
		}
		if sourceDir != "" {
			if info, statErr := os.Stat(resolveModelSourceDir(sourceDir, modelID)); statErr != nil || !info.IsDir() {
				return siteSettings{}, fmt.Errorf("primary model does not exist: %s", modelID)
			}
		}
		normalized.PrimaryModelID = modelID
	}

	return normalized, nil
}

func normalizeSiteStaticAssetPath(value string, fallback string) (string, error) {
	candidate := strings.TrimSpace(value)
	if candidate == "" {
		candidate = fallback
	}

	candidate = strings.TrimPrefix(strings.ReplaceAll(candidate, "\\", "/"), "/")
	if candidate == "" {
		return "", nil
	}

	if strings.Contains(candidate, "..") {
		return "", errors.New("path must not contain ..")
	}

	return candidate, nil
}

func normalizeSiteModelSelectedModelPath(sourceDir string, modelID string, value string) (string, error) {
	candidate := strings.TrimSpace(value)
	if candidate == "" {
		return "", nil
	}

	relativePath, err := sanitizeRelativeFilePath(candidate)
	if err != nil {
		return "", err
	}

	ext := strings.ToLower(filepath.Ext(relativePath))
	if !isModelExtension(ext) {
		return "", errors.New("selected model path must point to a supported model file")
	}

	fullPath := filepath.Join(resolveModelSourceDir(sourceDir, modelID), relativePath)
	if info, err := os.Stat(fullPath); err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("selected model file does not exist: %s", relativePath)
		}
		return "", err
	} else if info.IsDir() {
		return "", errors.New("selected model path must point to a file")
	}

	return toPosixPath(relativePath), nil
}

func hasAnySiteModelSpecs(specs siteModelSpecs) bool {
	return specs.OverallLength != "" ||
		specs.WaterlineLength != "" ||
		specs.Beam != "" ||
		specs.Depth != "" ||
		specs.Draft != "" ||
		specs.NavigationArea != "" ||
		specs.MainEnginePower != "" ||
		specs.DesignSpeed != "" ||
		specs.RatedCapacity != "" ||
		specs.PowerType != "" ||
		specs.Material != "" ||
		specs.CertificateType != ""
}

func hasAnySiteModelContent(content siteModelContent) bool {
	return content.DisplayName != "" ||
		content.Type != "" ||
		content.Price != "" ||
		content.SelectedModelPath != "" ||
		content.DetailImagePath != "" ||
		content.Summary != "" ||
		len(content.Engines) > 0 ||
		len(content.RenderConfig) > 0 ||
		hasAnySiteModelSpecs(content.Specs) ||
		hasAnySiteOrderConfig(content.OrderConfig)
}

func hasAnySiteOrderConfig(content siteOrderConfig) bool {
	return len(content.AppearanceOptions) > 0 ||
		len(content.ColorOptions) > 0 ||
		len(content.InteriorOptions) > 0 ||
		len(content.PowerOptions) > 0 ||
		len(content.OptionalSeriesOptions) > 0 ||
		len(content.FocusTargets) > 0
}

func normalizeSiteModelDetailImagePath(sourceDir string, modelID string, value string) (string, error) {
	candidate := strings.TrimSpace(value)
	if candidate == "" {
		return "", nil
	}

	relativePath, err := sanitizeRelativeFilePath(candidate)
	if err != nil {
		return "", errors.New("detailImagePath must be a relative file path inside the model directory")
	}

	extension := strings.ToLower(filepath.Ext(relativePath))
	if !isPreviewImageExtension(extension) {
		return "", errors.New("detailImagePath must point to a png, jpg, jpeg, or webp image")
	}

	modelDir := resolveModelSourceDir(sourceDir, modelID)
	absolutePath := filepath.Join(modelDir, filepath.FromSlash(relativePath))
	if !isWithinBaseDirectory(modelDir, absolutePath) {
		return "", errors.New("detailImagePath may not escape the model directory")
	}

	info, err := os.Stat(absolutePath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("detail image does not exist: %s", relativePath)
		}

		return "", fmt.Errorf("read detail image: %w", err)
	}

	if info.IsDir() {
		return "", errors.New("detailImagePath must point to a file")
	}

	return relativePath, nil
}

func normalizeModelType(value string) string {
	switch strings.TrimSpace(value) {
	case "新能源船":
		return "新能源船"
	case "应急救援船":
		return "应急救援船"
	case "公务执法艇":
		return "公务执法艇"
	case "游艇":
		return "游艇"
	default:
		return ""
	}
}

func buildSiteVideo(existingID string, input siteVideoInput) (siteVideo, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return siteVideo{}, errors.New("title is required")
	}

	platform, externalURL, embedURL, err := normalizeExternalVideoURL(input.URL)
	if err != nil {
		return siteVideo{}, err
	}

	videoID := existingID
	if videoID == "" {
		videoID = newSiteVideoID(platform)
	}

	return siteVideo{
		ID:          videoID,
		Title:       title,
		Summary:     strings.TrimSpace(input.Summary),
		Platform:    platform,
		SourceURL:   externalURL,
		ExternalURL: externalURL,
		EmbedURL:    embedURL,
	}, nil
}

func newSiteVideoID(platform string) string {
	return fmt.Sprintf("%s-%d", platform, time.Now().UTC().UnixNano())
}

func displayPlatformName(platform string) string {
	switch platform {
	case "youtube":
		return "YouTube"
	case "bilibili":
		return "Bilibili"
	default:
		return platform
	}
}

func findSiteVideoIndex(videos []siteVideo, targetID string) int {
	for index, video := range videos {
		if video.ID == targetID {
			return index
		}
	}

	return -1
}

func normalizeExternalVideoURL(raw string) (string, string, string, error) {
	parsedURL, err := parseExternalVideoURL(raw)
	if err != nil {
		return "", "", "", err
	}

	host := strings.ToLower(parsedURL.Hostname())
	switch host {
	case "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be":
		externalURL, embedURL, err := buildYouTubeURLs(parsedURL, host)
		if err != nil {
			return "", "", "", err
		}
		return "youtube", externalURL, embedURL, nil
	case "bilibili.com", "www.bilibili.com", "m.bilibili.com", "player.bilibili.com":
		externalURL, embedURL, err := buildBilibiliURLs(parsedURL, host)
		if err != nil {
			return "", "", "", err
		}
		return "bilibili", externalURL, embedURL, nil
	case "b23.tv":
		return "", "", "", errors.New("b23.tv short links are not supported yet; please paste the full bilibili.com URL")
	default:
		return "", "", "", errors.New("only YouTube and Bilibili video links are supported")
	}
}

func parseExternalVideoURL(raw string) (*url.URL, error) {
	candidate := strings.TrimSpace(raw)
	if candidate == "" {
		return nil, errors.New("video URL is required")
	}

	parsedURL, err := url.Parse(candidate)
	if err != nil {
		return nil, fmt.Errorf("parse video URL: %w", err)
	}

	if parsedURL.Scheme == "" && parsedURL.Host == "" {
		parsedURL, err = url.Parse("https://" + candidate)
		if err != nil {
			return nil, fmt.Errorf("parse video URL: %w", err)
		}
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return nil, errors.New("video URL must start with http:// or https://")
	}

	if parsedURL.Hostname() == "" {
		return nil, errors.New("video URL must include a valid hostname")
	}

	return parsedURL, nil
}

func buildYouTubeURLs(parsedURL *url.URL, host string) (string, string, error) {
	var videoID string
	segments := splitURLPath(parsedURL.Path)

	switch host {
	case "youtu.be":
		if len(segments) > 0 {
			videoID = segments[0]
		}
	default:
		switch {
		case len(segments) > 0 && segments[0] == "watch":
			videoID = strings.TrimSpace(parsedURL.Query().Get("v"))
		case len(segments) >= 2 && (segments[0] == "embed" || segments[0] == "shorts" || segments[0] == "live"):
			videoID = segments[1]
		}
	}

	videoID = strings.TrimSpace(videoID)
	if !youtubeVideoIDPattern.MatchString(videoID) {
		return "", "", errors.New("could not extract a valid YouTube video ID")
	}

	externalURL := "https://www.youtube.com/watch?v=" + videoID
	embedURL := "https://www.youtube.com/embed/" + videoID + "?playsinline=1&rel=0"
	return externalURL, embedURL, nil
}

func buildBilibiliURLs(parsedURL *url.URL, host string) (string, string, error) {
	query := parsedURL.Query()

	if host == "player.bilibili.com" {
		if bvid := normalizeBilibiliBVID(query.Get("bvid")); bvid != "" {
			return bilibiliVideoURLs("bvid", bvid)
		}
		if aid := normalizeNumericID(query.Get("aid")); aid != "" {
			return bilibiliVideoURLs("aid", aid)
		}
		if episodeID := normalizeNumericID(query.Get("episodeId")); episodeID != "" {
			return bilibiliVideoURLs("episodeId", episodeID)
		}
		if seasonID := normalizeNumericID(query.Get("seasonId")); seasonID != "" {
			return bilibiliVideoURLs("seasonId", seasonID)
		}
	}

	segments := splitURLPath(parsedURL.Path)
	switch {
	case len(segments) >= 2 && segments[0] == "video":
		if bvid := normalizeBilibiliBVID(segments[1]); bvid != "" {
			return bilibiliVideoURLs("bvid", bvid)
		}

		lowerSegment := strings.ToLower(strings.TrimSpace(segments[1]))
		if strings.HasPrefix(lowerSegment, "av") {
			if aid := normalizeNumericID(strings.TrimPrefix(lowerSegment, "av")); aid != "" {
				return bilibiliVideoURLs("aid", aid)
			}
		}
	case len(segments) >= 3 && segments[0] == "bangumi" && segments[1] == "play":
		lowerSegment := strings.ToLower(strings.TrimSpace(segments[2]))
		if strings.HasPrefix(lowerSegment, "ep") {
			if episodeID := normalizeNumericID(strings.TrimPrefix(lowerSegment, "ep")); episodeID != "" {
				return bilibiliVideoURLs("episodeId", episodeID)
			}
		}
		if strings.HasPrefix(lowerSegment, "ss") {
			if seasonID := normalizeNumericID(strings.TrimPrefix(lowerSegment, "ss")); seasonID != "" {
				return bilibiliVideoURLs("seasonId", seasonID)
			}
		}
	}

	return "", "", errors.New("could not extract a supported Bilibili video ID")
}

func bilibiliVideoURLs(idType string, value string) (string, string, error) {
	switch idType {
	case "bvid":
		return "https://www.bilibili.com/video/" + value + "/", "https://player.bilibili.com/player.html?bvid=" + value + "&danmaku=0", nil
	case "aid":
		return "https://www.bilibili.com/video/av" + value + "/", "https://player.bilibili.com/player.html?aid=" + value + "&danmaku=0", nil
	case "episodeId":
		return "https://www.bilibili.com/bangumi/play/ep" + value, "https://player.bilibili.com/player.html?episodeId=" + value + "&danmaku=0", nil
	case "seasonId":
		return "https://www.bilibili.com/bangumi/play/ss" + value, "https://player.bilibili.com/player.html?seasonId=" + value + "&danmaku=0", nil
	default:
		return "", "", errors.New("unsupported Bilibili video reference")
	}
}

func splitURLPath(rawPath string) []string {
	trimmed := strings.Trim(strings.TrimSpace(rawPath), "/")
	if trimmed == "" {
		return nil
	}

	segments := strings.Split(trimmed, "/")
	filtered := make([]string, 0, len(segments))
	for _, segment := range segments {
		segment = strings.TrimSpace(segment)
		if segment == "" {
			continue
		}

		filtered = append(filtered, segment)
	}

	return filtered
}

func normalizeBilibiliBVID(value string) string {
	candidate := strings.TrimSpace(value)
	if bilibiliBVIDPattern.MatchString(candidate) {
		return "BV" + candidate[2:]
	}

	return ""
}

func normalizeNumericID(value string) string {
	candidate := strings.TrimSpace(value)
	if numericIDPattern.MatchString(candidate) {
		return candidate
	}

	return ""
}
