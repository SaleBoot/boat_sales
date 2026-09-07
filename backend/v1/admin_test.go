package v1

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func testStandardFocusTargets() map[string]siteOrderFocusPreset {
	return map[string]siteOrderFocusPreset{
		"exterior":     {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "orbit"},
		"interior":     {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "first-person"},
		"engine":       {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "orbit"},
		"console":      {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "orbit"},
		"smart-system": {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "orbit"},
		"POINT1":       {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "orbit"},
		"POINT2":       {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "orbit"},
		"POINT3":       {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "orbit"},
		"POINT4":       {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "orbit"},
		"POINT5":       {Zoom: 7, Target: siteVector3{Y: 0.7}, CameraMode: "orbit"},
	}
}

func TestSanitizeRelativeSubdirectoryAllowsAssetFolderNames(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "ascii folder",
			input: "cc",
			want:  "cc",
		},
		{
			name:  "nested material folder",
			input: "tt/cc",
			want:  "tt/cc",
		},
		{
			name:  "chinese asset folder",
			input: "船舱+栏杆+沙发（2048）/tt",
			want:  "船舱+栏杆+沙发（2048）/tt",
		},
		{
			name:  "backslash normalized",
			input: `船体+顶棚（2048）\tt`,
			want:  "船体+顶棚（2048）/tt",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := sanitizeRelativeSubdirectory(test.input)
			if err != nil {
				t.Fatalf("sanitizeRelativeSubdirectory(%q) returned error: %v", test.input, err)
			}

			if got != test.want {
				t.Fatalf("sanitizeRelativeSubdirectory(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestNormalizeSiteOrderFocusTargetsProvidesStandardCameraSlots(t *testing.T) {
	normalized := normalizeSiteOrderFocusTargets(map[string]siteOrderFocusPreset{
		"overview": {
			Zoom:     3,
			Target:   siteVector3{X: 1, Y: 2, Z: 3},
			Rotation: siteVector3{X: 10, Y: 20, Z: 30},
		},
		"smartSystem": {
			Zoom:   1.5,
			Target: siteVector3{X: 4, Y: 5, Z: 6},
		},
	})

	for _, target := range standardSiteOrderFocusTargets {
		if _, ok := normalized[target.Key]; !ok {
			t.Fatalf("missing standard focus target %q in %#v", target.Key, normalized)
		}
	}

	if normalized["exterior"].Target.X != 1 || normalized["exterior"].Zoom != 3 {
		t.Fatalf("overview alias was not applied to exterior: %+v", normalized["exterior"])
	}
	if normalized["smart-system"].Target.X != 4 || normalized["smart-system"].Zoom != 1.5 {
		t.Fatalf("smartSystem alias did not normalize to distance and target only: %+v", normalized["smart-system"])
	}
	if normalized["interior"].CameraMode != "first-person" {
		t.Fatalf("interior camera mode = %q, want first-person", normalized["interior"].CameraMode)
	}
	if normalized["exterior"].CameraMode != "orbit" {
		t.Fatalf("exterior camera mode = %q, want orbit", normalized["exterior"].CameraMode)
	}
	if normalized["exterior"].Rotation.Y != 20 {
		t.Fatalf("exterior rotation = %+v, want Y 20", normalized["exterior"].Rotation)
	}

	normalized = normalizeSiteOrderFocusTargets(map[string]siteOrderFocusPreset{
		"engine": {
			Zoom:       2,
			Target:     siteVector3{X: 7},
			CameraMode: "first-person",
		},
		"console": {
			Zoom:       2,
			Target:     siteVector3{X: 8},
			CameraMode: "orbit",
		},
	})
	if normalized["engine"].CameraMode != "first-person" {
		t.Fatalf("engine camera mode = %q, want first-person", normalized["engine"].CameraMode)
	}
	if normalized["console"].CameraMode != "orbit" {
		t.Fatalf("console camera mode = %q, want orbit", normalized["console"].CameraMode)
	}
}

func TestHandleAdminUpdateModelEnginesOnlyUpdatesTargetModelEngines(t *testing.T) {
	tempDir := t.TempDir()
	sourceDir := filepath.Join(tempDir, "gltf")
	contentPath := filepath.Join(tempDir, "site-content.json")

	for _, modelID := range []string{"40mijianchuan", "Cabnet"} {
		if err := os.MkdirAll(filepath.Join(sourceDir, modelID), 0o755); err != nil {
			t.Fatalf("create model dir: %v", err)
		}
	}

	application := &app{
		sourceDir:       sourceDir,
		contentPath:     contentPath,
		focusTargetsDir: filepath.Join(tempDir, "focus-targets"),
	}

	initialContent := defaultSiteContent()
	initialContent.Models["40mijianchuan"] = siteModelContent{
		DisplayName: "40m",
		Type:        "公务执法艇",
		Summary:     "keep this summary",
	}
	initialContent.Models["Cabnet"] = siteModelContent{
		DisplayName: "Cabnet",
		Engines: []siteEngineMount{
			{
				Enabled: true,
				Type:    "outboard-a",
				Position: siteVector3{
					X: 1,
					Y: 2,
					Z: 3,
				},
			},
		},
	}
	if err := application.writeSiteContent(initialContent); err != nil {
		t.Fatalf("write initial content: %v", err)
	}

	payload := siteModelEnginesInput{
		Engines: []siteEngineMount{
			{
				Enabled: true,
				Type:    "outboard-b",
				Position: siteVector3{
					X: 10,
					Y: 20,
					Z: 30,
				},
				Rotation: siteVector3{
					Y: 1.57,
				},
			},
		},
	}
	if err := application.updateSiteModelEngines("Cabnet", payload.Engines); err != nil {
		t.Fatalf("updateSiteModelEngines returned error: %v", err)
	}

	content, err := application.readSiteContent()
	if err != nil {
		t.Fatalf("read site content: %v", err)
	}

	if got := content.Models["40mijianchuan"].Summary; got != "keep this summary" {
		t.Fatalf("40mijianchuan summary changed to %q", got)
	}
	if len(content.Models["40mijianchuan"].Engines) != 0 {
		t.Fatalf("40mijianchuan engines changed: %+v", content.Models["40mijianchuan"].Engines)
	}

	cabnetEngines := content.Models["Cabnet"].Engines
	if len(cabnetEngines) != 1 {
		t.Fatalf("Cabnet engines length = %d, want 1", len(cabnetEngines))
	}
	if cabnetEngines[0].Type != "outboard-b" || cabnetEngines[0].Position.X != 10 || cabnetEngines[0].Rotation.Y != 1.57 {
		t.Fatalf("Cabnet engine not updated correctly: %+v", cabnetEngines[0])
	}
}

func TestDecodeSiteModelContentInputAcceptsFullAdminPayload(t *testing.T) {
	payload := map[string]any{
		"displayName":       "JS-119B",
		"type":              "公务执法艇",
		"price":             "1280000",
		"selectedModelPath": "1198.fbx",
		"detailImagePath":   "tbrender.png",
		"summary":           "demo",
		"engines": []siteEngineMount{
			{
				Enabled: true,
				Type:    "outboard-a",
				Position: siteVector3{
					X: 1,
					Y: 2,
					Z: 3,
				},
			},
		},
		"specs": siteModelSpecs{
			OverallLength: "11.9",
		},
		"orderConfig": siteOrderConfig{
			ColorOptions: []siteOrderColorOption{
				{
					ID:    "white",
					Label: "白色",
					Hex:   "#ffffff",
				},
			},
			OptionalSeriesOptions: []siteOrderOption{
				{
					ID:          "smart-system",
					Label:       "智能系统",
					Price:       68000,
					FocusTarget: "smart-system",
					MaterialOverrides: []siteOrderMaterialOverride{
						{
							MaterialSlots: []string{"01default"},
							BaseColorPath: "gltf/JS119B/smart-system/BaseColor.png",
						},
					},
				},
			},
			FocusTargets: testStandardFocusTargets(),
		},
		"renderConfig": siteRenderConfig{
			"studioLook": true,
			"focusTargets": map[string]any{
				"smartSystem": map[string]any{
					"type": "exterior",
				},
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	input, err := decodeSiteModelContentInput(newJSONRequest(body))
	if err != nil {
		t.Fatalf("decodeSiteModelContentInput returned error: %v", err)
	}

	if input.SelectedModelPath != "1198.fbx" {
		t.Fatalf("selectedModelPath = %q, want 1198.fbx", input.SelectedModelPath)
	}
	if input.RenderConfig["studioLook"] != true {
		t.Fatalf("renderConfig studioLook not decoded: %#v", input.RenderConfig)
	}
	if len(input.OrderConfig.ColorOptions) != 1 {
		t.Fatalf("orderConfig color options length = %d, want 1", len(input.OrderConfig.ColorOptions))
	}
	if len(input.OrderConfig.OptionalSeriesOptions) != 1 {
		t.Fatalf("orderConfig optional series options length = %d, want 1", len(input.OrderConfig.OptionalSeriesOptions))
	}
	if got := len(input.OrderConfig.OptionalSeriesOptions[0].MaterialOverrides); got != 1 {
		t.Fatalf("orderConfig material overrides length = %d, want 1", got)
	}
	if got := input.OrderConfig.OptionalSeriesOptions[0].MaterialOverrides[0].BaseColorPath; got != "gltf/JS119B/smart-system/BaseColor.png" {
		t.Fatalf("orderConfig material override baseColorPath = %q", got)
	}
	if len(input.OrderConfig.FocusTargets) != len(testStandardFocusTargets()) {
		t.Fatalf("orderConfig focus targets length = %d, want %d", len(input.OrderConfig.FocusTargets), len(testStandardFocusTargets()))
	}
}

func TestAdminJSONPayloadContractsAcceptFrontendFields(t *testing.T) {
	tests := []struct {
		name    string
		payload map[string]any
		decode  func([]byte) error
	}{
		{
			name: "admin login",
			payload: map[string]any{
				"email":    "display@preview.com",
				"password": "cqjscb2026",
			},
			decode: func(body []byte) error {
				var input adminLoginInput
				return decodeStrictPayloadForTest(body, &input)
			},
		},
		{
			name: "change password",
			payload: map[string]any{
				"currentPassword": "current-password",
				"newPassword":     "next-password-2026",
			},
			decode: func(body []byte) error {
				var input adminChangePasswordInput
				return decodeStrictPayloadForTest(body, &input)
			},
		},
		{
			name: "model engines",
			payload: map[string]any{
				"engines": []siteEngineMount{
					{
						Enabled: true,
						Type:    "outboard-a",
						Position: siteVector3{
							X: 1,
							Y: 2,
							Z: 3,
						},
						Rotation: siteVector3{
							Y: 1.57,
						},
					},
				},
			},
			decode: func(body []byte) error {
				var input siteModelEnginesInput
				return decodeStrictPayloadForTest(body, &input)
			},
		},
		{
			name: "hero content",
			payload: map[string]any{
				"kicker":               "京穗船舶",
				"heading":              "面向客户的船型方案",
				"summary":              "通过 3D 看船理解方案。",
				"proofPoints":          []string{"3D 看船", "参数对比", "销售跟进"},
				"primaryButtonLabel":   "立即看船",
				"secondaryButtonLabel": "提交意向",
				"scrollCueLabel":       "继续了解",
			},
			decode: func(body []byte) error {
				var input siteHeroContentInput
				return decodeStrictPayloadForTest(body, &input)
			},
		},
		{
			name: "site settings",
			payload: map[string]any{
				"primaryModelId": "FireFighting",
				"heroImagePath":  "pdf/FrontPage.png",
				"brochurePath":   "pdf/2026京穗船舶产品宣传册.pdf",
				"compareLimit":   4,
			},
			decode: func(body []byte) error {
				var input siteSettingsInput
				return decodeStrictPayloadForTest(body, &input)
			},
		},
		{
			name: "video content",
			payload: map[string]any{
				"title":   "航行视频",
				"url":     "https://youtu.be/dQw4w9WgXcQ",
				"summary": "展示船型动态效果。",
			},
			decode: func(body []byte) error {
				_, err := decodeSiteVideoInput(newJSONRequest(body))
				return err
			},
		},
		{
			name: "texture type",
			payload: map[string]any{
				"modelId":           "FireFighting",
				"path":              "tt/cc/basecolor.png",
				"textureType":       "baseColor",
				"useAlphaAsOpacity": true,
			},
			decode: func(body []byte) error {
				_, err := decodeTextureTypeUpdateInput(newJSONRequest(body))
				return err
			},
		},
		{
			name: "uv set material render profile",
			payload: map[string]any{
				"modelId":          "FireFighting",
				"path":             "tt/cc",
				"materialNameHint": "M_01___Default",
				"renderProfile": map[string]any{
					"alphaMode":          "blend",
					"side":               "double",
					"depthWrite":         "off",
					"depthTest":          "on",
					"alphaCutoff":        0.02,
					"renderOrder":        10,
					"clearcoat":          0.35,
					"clearcoatRoughness": 0.22,
				},
			},
			decode: func(body []byte) error {
				_, err := decodeUVSetMaterialHintUpdateInput(newJSONRequest(body))
				return err
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			body, err := json.Marshal(test.payload)
			if err != nil {
				t.Fatalf("marshal payload: %v", err)
			}

			if err := test.decode(body); err != nil {
				t.Fatalf("decode returned error: %v", err)
			}
		})
	}
}

func newJSONRequest(body []byte) *http.Request {
	request := httptest.NewRequest(http.MethodPut, "/api/admin/models/Test/content", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	return request
}

func decodeStrictPayloadForTest(body []byte, destination any) error {
	request := newJSONRequest(body)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(destination)
}

func TestUpdateSiteHeroContentPreservesExistingModelsAndVideos(t *testing.T) {
	tempDir := t.TempDir()
	contentPath := filepath.Join(tempDir, "site-content.json")

	application := &app{
		contentPath:     contentPath,
		focusTargetsDir: filepath.Join(tempDir, "focus-targets"),
	}

	initialContent := defaultSiteContent()
	initialContent.Videos = []siteVideo{
		{
			ID:        "video-1",
			Title:     "Demo Video",
			Platform:  "youtube",
			SourceURL: "https://youtu.be/example",
		},
	}
	initialContent.Models["Cabnet"] = siteModelContent{
		DisplayName: "Cabnet",
		Type:        "公务执法艇",
		Summary:     "keep model content",
	}
	if err := application.writeSiteContent(initialContent); err != nil {
		t.Fatalf("write initial content: %v", err)
	}

	input := siteHeroContentInput{
		Kicker:               "新首屏眉标题",
		Heading:              "新首屏标题",
		Summary:              "新首屏摘要",
		ProofPoints:          []string{"标签一", "标签二", "标签三"},
		PrimaryButtonLabel:   "主按钮",
		SecondaryButtonLabel: "次按钮",
		ScrollCueLabel:       "滚动提示",
	}

	if err := application.updateSiteHeroContent(input); err != nil {
		t.Fatalf("updateSiteHeroContent returned error: %v", err)
	}

	content, err := application.readSiteContent()
	if err != nil {
		t.Fatalf("read site content: %v", err)
	}

	if got := content.Hero.Kicker; got != input.Kicker {
		t.Fatalf("hero kicker = %q, want %q", got, input.Kicker)
	}
	if got := content.Hero.Heading; got != input.Heading {
		t.Fatalf("hero heading = %q, want %q", got, input.Heading)
	}
	if len(content.Hero.ProofPoints) != 3 {
		t.Fatalf("hero proof points length = %d, want 3", len(content.Hero.ProofPoints))
	}

	if got := len(content.Videos); got != 1 {
		t.Fatalf("videos length = %d, want 1", got)
	}
	if got := content.Models["Cabnet"].Summary; got != "keep model content" {
		t.Fatalf("model summary changed to %q", got)
	}
}

func TestSanitizeRelativeSubdirectoryRejectsUnsafePaths(t *testing.T) {
	tests := []string{
		"../escape",
		"/absolute",
		`bad:name`,
		"bad\x00name",
	}

	for _, input := range tests {
		t.Run(input, func(t *testing.T) {
			if got, err := sanitizeRelativeSubdirectory(input); err == nil {
				t.Fatalf("sanitizeRelativeSubdirectory(%q) = %q, want error", input, got)
			}
		})
	}
}

func TestScanAdminUVSetsUsesNestedTextureDirectory(t *testing.T) {
	assignments := defaultTextureAssignments()
	uvSets, err := scanAdminUVSets(
		"../gltf",
		"TestHigh",
		"../gltf/TestHigh/船舱+栏杆+沙发（2048）",
		"船舱+栏杆+沙发（2048）",
		nil,
		assignments,
	)
	if err != nil {
		t.Fatalf("scanAdminUVSets returned error: %v", err)
	}

	if len(uvSets) != 1 {
		t.Fatalf("scanAdminUVSets returned %d uv sets, want 1", len(uvSets))
	}

	if got, want := uvSets[0].DirectoryPath, "船舱+栏杆+沙发（2048）/tt"; got != want {
		t.Fatalf("directoryPath = %q, want %q", got, want)
	}
}
