package types

// User Role
type UserRole struct {
	Id    int    `json:"id"`
	StrID string `json:"strId"`
	Label string `json:"label"`
}

const (
	RoleIDRegularUser = iota // 普通用户角色 // 0
	RoleIDAdmin              // 管理员角色   // 1
)

var roleIDList = []UserRole{
	{Id: RoleIDRegularUser, StrID: "regularUser", Label: "普通用户"},
	{Id: RoleIDAdmin, StrID: "admin", Label: "管理员"},
}

// map
var roleIDMap = buildRoleIDMap()

func buildRoleIDMap() map[int]UserRole {
	m := make(map[int]UserRole, len(roleIDList))
	for _, v := range roleIDList {
		m[v.Id] = v
	}
	return m
}

func ValidateRoleID(aID int) bool {
	_, ok := roleIDMap[aID]
	return ok
}

func GetRoleID(aID int) (UserRole, bool) {
	roleId, ok := roleIDMap[aID]
	return roleId, ok
}
