package v1

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	cosSyncScriptFileName = "cos_sync.py"
	cosSyncEnvFileName    = "cos-sync.env"
)

// syncAssetsToCOS 调用 cos_sync.py 脚本将生成的静态资源同步到腾讯云对象存储（COS）。
// 它会检查所有依赖项（Python 解释器、同步脚本、环境变量文件）是否存在，
// 然后在设定的超时时间内执行同步命令。
func (a *app) syncAssetsToCOS() error {
	// 构建 cos_sync.py 脚本、Python 解释器和环境变量文件的绝对路径
	scriptPath := filepath.Join(a.sourceDir, cosSyncScriptFileName)
	pythonPath := filepath.Join(a.repoRoot, ".venv-cos", "bin", "python")
	envFilePath := filepath.Join(a.repoRoot, "data", cosSyncEnvFileName)

	// 检查所需文件是否存在，如果任何一个不存在，则跳过同步过程
	for _, candidatePath := range []string{scriptPath, pythonPath, envFilePath} {
		if _, err := os.Stat(candidatePath); err != nil {
			// 如果文件只是不存在，则这不是一个错误，我们只是跳过同步
			if os.IsNotExist(err) {
				return nil
			}
			// 对于其他类型的错误（如权限问题），则返回错误
			return fmt.Errorf("inspect cos sync dependency %s: %w", candidatePath, err)
		}
	}

	// 设置一个带有 20 分钟超时的上下文，以防止同步过程无限期挂起
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	// 准备要执行的命令
	command := exec.CommandContext(
		ctx,
		pythonPath,
		scriptPath,
		"--source", a.publicDir, // 本地资源目录
		"--prefix", "gltf", // COS 中的目标前缀
		"--env-file", envFilePath, // 包含 COS 凭证的环境变量文件
	)
	command.Dir = a.repoRoot // 设置命令的工作目录

	// 执行命令并捕获其组合输出（stdout 和 stderr）
	output, err := command.CombinedOutput()
	outputText := strings.TrimSpace(string(output))
	if outputText != "" {
		log.Printf("COS sync output:\n%s", outputText)
	}

	// 检查是否因为超时而退出
	if ctx.Err() == context.DeadlineExceeded {
		return fmt.Errorf("sync assets to cos timed out after %s", 20*time.Minute)
	}

	// 检查命令执行是否出错
	if err != nil {
		if outputText == "" {
			return fmt.Errorf("sync assets to cos: %w", err)
		}
		// 如果有输出，将其附加到错误信息中
		return fmt.Errorf("sync assets to cos: %w: %s", err, outputText)
	}

	return nil
}
