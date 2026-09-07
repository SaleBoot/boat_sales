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

/*
// 把 ApiResponse 定义为一个泛型结构体。这样既保留了结构体的统一性，
// 又让具体的业务数据具备了强类型。
// T 代表任意具体的类型
type ApiResponse[T any] struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Data    T      `json:"data"` // 这里不再是 interface{}，而是具体类型 T
}

// 在 Handler 中使用示例：
func HandleGetBoat(c *gin.Context) {
    boat := models.SysBoat{BoatName: "晓风号"}

    // 实例化一个只装载 SysBoat 类型的响应
    c.JSON(http.StatusOK, ApiResponse[models.SysBoat]{
        Code:    200,
        Message: "Success",
        Data:    boat, // 如果你塞入一个 User 结构体，编译器在编译阶段就会直接报错！
    })
}
*/
