package types

// -----------------------------

type Vec3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type Color struct {
	Hex string `json:"hex"`
}

type Material struct {
	Type  string `json:"type"`
	Color Color  `json:"color"`
}

type SceneObject struct {
	ID       string   `json:"id"`
	Kind     string   `json:"kind"`
	Position Vec3     `json:"position"`
	Rotation Vec3     `json:"rotation"`
	Scale    Vec3     `json:"scale"`
	Material Material `json:"material"`
}

type ScenePayload struct {
	Name    string        `json:"name"`
	Camera  Vec3          `json:"camera"`
	Objects []SceneObject `json:"objects"`
}

// --------------------------------
type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}
