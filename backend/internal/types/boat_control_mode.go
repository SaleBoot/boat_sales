package types

// ControlMode 操控方式（varchar (64)）
// 船舶 / 游艇主流操控类型：
// 方向盘操控（常规）
// 手柄操控（快艇、小型游艇高频）
// 方向盘+手柄双控
// 远程操控
// 自动驾驶
// 舵杆操控
//
// 英文 ControlMode: Steering Wheel / Joystick / Dual Control

type BoatCtrlMode struct {
	StrID string `json:"strID"`
	Label string `json:"label"`
}

const (
	BoatCtrlModeSteeringWheel = "SteeringWheel"
	BoatCtrlModeJoystick      = "Joystick"
	BoatCtrlModeDualControl   = "DualControl"
)

var boatCtrlModeList = []BoatCtrlMode{
	{StrID: BoatCtrlModeSteeringWheel, Label: "方向盘操控"},
	{StrID: BoatCtrlModeJoystick, Label: "手柄操控"},
	{StrID: BoatCtrlModeDualControl, Label: "方向盘+手柄双控"},
}

// map
var boatCtrlModeMap = buildBoatCtrlModeMap()

func buildBoatCtrlModeMap() map[string]BoatCtrlMode {
	m := make(map[string]BoatCtrlMode, len(boatCtrlModeList))
	for _, v := range boatCtrlModeList {
		m[v.StrID] = v
	}
	return m
}

func ValidateBoatCtrlMode(aStrID string) bool {
	_, ok := boatCtrlModeMap[aStrID]
	return ok
}

func GetBoatCtrlMode(aStrID string) (BoatCtrlMode, bool) {
	mode, ok := boatCtrlModeMap[aStrID]
	if !ok {
		return mode, false
	}
	return mode, true
}
