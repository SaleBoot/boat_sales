package v1

import (
	"boatsales-backend/internal/models"
	"boatsales-backend/internal/types"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- User Handlers ---

type CreateUserInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (a *app) handleGetAllUsers(c *gin.Context) {
	users, err := a.userDao.GetAllSysUsers()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, fmt.Errorf("failed to get users: %w", err))
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully retrieved users",
		Data:    users,
	})
}

func (a *app) handleCreateUser(c *gin.Context) {
	var input CreateUserInput

	if err := c.ShouldBindJSON(&input); err != nil {
		log.Println("handleCreateUser 01")
		c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error())})
		return
	}
	log.Println("handleCreateUser 00000", input)

	// Validate input
	if strings.TrimSpace(input.Username) == "" {
		log.Println("handleCreateUser 02")
		c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest,
			Message: "username is required"})
		return
	}
	email := normalizeAdminEmail(input.Email)
	if email == "" {
		log.Println("handleCreateUser 03")
		c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest,
			Message: "email is required"})
		return
	}

	// Validate password complexity
	if err := validateAdminPassword(input.Password); err != nil {
		log.Println("handleCreateUser 04")
		c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest, Message: err.Error()})
		return
	}

	// Hash the password
	passwordHash, err := hashAdminPassword(input.Password)
	if err != nil {
		log.Printf("failed to hash password for new user: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{Code: http.StatusInternalServerError, Message: "failed to process password"})
		return
	}

	// Prepare the user model
	newUser := models.SysUser{
		Username:     input.Username,
		Email:        email,
		PasswordHash: passwordHash,
	}

	if err := a.userDao.CreateUser(&newUser); err != nil {
		// TODO: Check for specific database errors, like duplicate entry
		log.Printf("failed to create user in database: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{Code: http.StatusInternalServerError, Message: fmt.Sprintf("failed to create user: %s", err.Error())})
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

func (a *app) handleDeleteUsers(c *gin.Context) {
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

func (a *app) handleGetUserByEmail(c *gin.Context) {
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

func (a *app) handleUpdateUserByEmail(c *gin.Context) {
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
		if err := validateAdminPassword(input.Password); err != nil {
			c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest, Message: err.Error()})
			return
		}

		passwordHash, err := hashAdminPassword(input.Password)
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
