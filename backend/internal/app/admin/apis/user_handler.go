package apis

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/types"
	"boatsales-backend/pkg/utils"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UserHandler struct {
	sessionMu sync.Mutex
	sessions  map[string]adminSession

	userDao *dao.SysUserDao
}

func NewUserHandler(aUserDao *dao.SysUserDao) *UserHandler {
	return &UserHandler{userDao: aUserDao, // 依赖注入
		sessions: make(map[string]adminSession),
	}
}

// --- User Handlers ---

type CreateUserInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (aH *UserHandler) HandleGetAllUsers(c *gin.Context) {
	users, err := aH.userDao.GetAllSysUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get users: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully retrieved users",
		Data:    users,
	})
}

func (aH *UserHandler) HandleCreateUser(c *gin.Context) {
	var input CreateUserInput

	if err := c.ShouldBindJSON(&input); err != nil {
		log.Println("HandleCreateUser 01")
		c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error())})
		return
	}
	log.Println("HandleCreateUser 00000", input)

	// Validate input
	if strings.TrimSpace(input.Username) == "" {
		log.Println("handleCreateUser 02")
		c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest,
			Message: "username is required"})
		return
	}
	email := utils.NormalizeAdminEmail(input.Email)
	if email == "" {
		log.Println("HandleCreateUser 03")
		c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest,
			Message: "email is required"})
		return
	}

	// Validate password complexity
	if err := utils.ValidateAdminPassword(input.Password); err != nil {
		log.Println("HandleCreateUser 04")
		c.JSON(http.StatusBadRequest,
			types.ApiResponse{Code: http.StatusBadRequest, Message: err.Error()})
		return
	}

	// Hash the password
	passwordHash, err := utils.HashAdminPassword(input.Password)
	if err != nil {
		log.Printf("failed to hash password for new user: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: "failed to process password"})
		return
	}

	// Prepare the user model
	newUser := models.SysUser{
		Username:     input.Username,
		Email:        email,
		PasswordHash: passwordHash,
	}

	if err := aH.userDao.CreateUser(&newUser); err != nil {
		// TODO: Check for specific database errors, like duplicate entry
		log.Printf("failed to create user in database: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to create user: %s", err.Error())})
		return
	}

	c.JSON(http.StatusCreated, types.ApiResponse{
		Code:    http.StatusCreated,
		Message: "Successfully created user",
		Data:    nil,
	})
}

type DeleteUsersInput struct {
	UserIDs []uint `json:"userIds"`
}

func (a *UserHandler) HandleDeleteUsers(c *gin.Context) {
	var input DeleteUsersInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	if len(input.UserIDs) == 0 {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "userIds is required",
		})
		return
	}

	if err := a.userDao.DeleteUsersByID(input.UserIDs); err != nil {
		log.Printf("failed to delete users: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to delete users",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully deleted users",
	})
}

func (a *UserHandler) HandleGetUserByEmail(c *gin.Context) {
	email := c.Param("email")
	user, err := a.userDao.GetUserByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, types.ApiResponse{
				Code:    http.StatusNotFound,
				Message: "user not found",
			})
			return
		}
		log.Printf("failed to get user by email: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to get user",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully retrieved user",
		Data:    user,
	})
}

type UpdateUserInput struct {
	Username string `json:"username"`
	Password string `json:"password,omitempty"`
}

func (a *UserHandler) HandleUpdateUserByEmail(c *gin.Context) {
	email := c.Param("email")
	var input UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	user, err := a.userDao.GetUserByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, types.ApiResponse{
				Code:    http.StatusNotFound,
				Message: "user not found",
			})
			return
		}
		log.Printf("failed to get user for update: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to find user",
		})
		return
	}

	// Update user fields
	user.Username = input.Username

	// If a new password is provided, validate and hash it.
	if input.Password != "" {
		if err := utils.ValidateAdminPassword(input.Password); err != nil {
			c.JSON(http.StatusBadRequest,
				types.ApiResponse{Code: http.StatusBadRequest, Message: err.Error()})
			return
		}

		passwordHash, err := utils.HashAdminPassword(input.Password)
		if err != nil {
			log.Printf("failed to hash new password for user %s: %v", email, err)
			c.JSON(http.StatusInternalServerError, types.ApiResponse{
				Code:    http.StatusInternalServerError,
				Message: "failed to process new password",
			})
			return
		}
		user.PasswordHash = passwordHash
	}

	if err := a.userDao.UpdateUser(user); err != nil {
		log.Printf("failed to update user: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to update user",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully updated user",
		Data:    user,
	})
}
