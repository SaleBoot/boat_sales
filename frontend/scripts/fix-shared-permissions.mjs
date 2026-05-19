/**
这个脚本就是一个文件权限修复工具，专门为解决在共享开发环境中（如多用户Linux、WSL、Docker）因用户和用户组不一致导致的文件访问问题而设计。

它的核心逻辑如下：

1.  **身份解析 (`resolveSharedIdentity`)**:
    *   首先，它会检查当前环境是否为 Linux，并且脚本是否以 `root` 用户权限运行。如果不是，它什么也不做。
    *   它尝试获取目标用户（默认为 `salesboat`）的 `uid` (用户ID) 和目标用户组（默认为与用户名相同）的 `gid` (用户组ID)。这是通过执行 `id -u` 和 `getent group` 这两个标准的Linux命令来实现的。
    *   如果成功获取到 `uid` 和 `gid`，它会返回一个包含这些信息的 `identity` 对象。

2.  **权限应用 (`applyPathPermissions`)**:
    *   这是一个递归函数，会遍历指定目录下的所有文件和子目录。
    *   **`chown` (改变所有者)**: 如果文件的当前 `uid` 或 `gid` 与解析到的目标 `identity` 不符，它会执行 `chown` 命令，将文件的所有者和所属组更改为目标值。
    *   **`chmod` (改变模式)**: 它会强制设置文件和目录的权限模式。目录被设置为 `2775`，文件被设置为 `0664`。
        *   `2775`: 目录所有者和同组用户有读、写、执行权限，其他用户只有读和执行权限。`2` (setgid) 意味着在该目录下创建的新文件会自动继承该目录的用户组。
        *   `0664`: 文件所有者和同组用户有读、写权限，其他用户只有读权限。

3.  **主函数 (`syncSharedPermissions` 和执行入口)**:
    *   `syncSharedPermissions` 函数负责编排整个流程，它接收一个路径数组，调用身份解析和权限应用函数。
    *   脚本的最后一部分检查它是否被直接执行。如果是，它会自动对 `public/gltf` 和 `dist` 这两个在构建过程中经常会产生新文件的目录执行权限修复。

这个脚本对于保持开发环境的一致性、避免因权限问题导致的构建失败或访问错误非常有帮助。
 * 
 * 
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// --- 路径定义 ---
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(scriptDir, '..')

/**
 * 通过执行外部命令来查找 Unix 用户或组的信息。
 * @param {string} command - 要执行的命令 (如 'id', 'getent')。
 * @param {string[]} args - 命令的参数数组。
 * @param {function(string): any} parser - 用于解析命令输出的函数。
 * @returns {any | null} 解析后的结果或 null。
 */
function lookupUnixIdentity(command, args, parser) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'] // 只捕获标准输出
  })

  if (result.status !== 0) {
    return null // 命令执行失败
  }

  return parser(result.stdout.trim())
}

/**
 * 解析并获取共享环境中目标用户和组的 UID 和 GID。
 * 只有在 Linux 环境下且以 root 用户运行时才会生效。
 * @param {string} ownerName - 目标用户名。
 * @param {string} groupName - 目标用户组名。
 * @returns {{uid: number, gid: number, owner: string, group: string} | null}
 */
function resolveSharedIdentity(ownerName, groupName) {
  // 仅在 root 权限的 Linux 环境下运行
  if (process.platform !== 'linux' || process.getuid?.() !== 0) {
    return null
  }

  const owner = `${ownerName || 'salesboat'}`.trim() || 'salesboat'
  const group = `${groupName || owner}`.trim() || owner
  // 使用 'id -u <owner>' 命令获取 UID
  const uid = lookupUnixIdentity('id', ['-u', owner], (value) => Number.parseInt(value, 10))
  // 使用 'getent group <group>' 命令获取 GID
  const gid = lookupUnixIdentity('getent', ['group', group], (value) => {
    const segments = value.split(':') // 'group:password:gid:users'
    return Number.parseInt(segments[2] ?? '', 10)
  })

  if (!Number.isInteger(uid) || !Number.isInteger(gid)) {
    return null // UID 或 GID 无效
  }

  return { uid, gid, owner, group }
}

/**
 * 递归地将权限和所有权应用到指定路径下的所有文件和目录。
 * @param {string} targetPath - 目标路径。
 * @param {object | null} identity - 包含 uid 和 gid 的身份对象。
 * @param {object} summary - 用于记录操作计数的摘要对象。
 */
function applyPathPermissions(targetPath, identity, summary) {
  if (!fs.existsSync(targetPath)) {
    return
  }

  const stat = fs.lstatSync(targetPath)
  if (stat.isSymbolicLink()) {
    return // 不处理符号链接
  }

  const isDirectory = stat.isDirectory()
  // 目录权限：2775 (rwxrwsr-x), 文件权限：0664 (rw-rw-r--)
  // 2775 中的 '2' (setgid) 确保在该目录下创建的新文件继承该目录的组。
  const desiredMode = isDirectory ? 0o2775 : 0o664

  // 如果所有权不匹配，则执行 chown。
  if (identity && (stat.uid !== identity.uid || stat.gid !== identity.gid)) {
    fs.chownSync(targetPath, identity.uid, identity.gid)
    summary.chownCount += 1
  }

  // 如果权限模式不匹配，则执行 chmod。
  if ((stat.mode & 0o7777) !== desiredMode) {
    fs.chmodSync(targetPath, desiredMode)
    summary.chmodCount += 1
  }

  // 如果是目录，则递归处理其内容。
  if (!isDirectory) {
    return
  }

  for (const entryName of fs.readdirSync(targetPath)) {
    applyPathPermissions(path.join(targetPath, entryName), identity, summary)
  }
}

/**
 * 同步指定路径数组的共享权限。
 * @param {string[]} targetPaths - 需要修复权限的路径数组。
 * @param {object} [options={}] - 选项，可以指定 ownerName 和 groupName。
 * @returns {object} 一个包含操作摘要的对象。
 */
export function syncSharedPermissions(targetPaths, options = {}) {
  // 从选项、环境变量或默认值中获取所有者和组名。
  const ownerName = options.ownerName ?? process.env.SALESBOAT_SHARED_OWNER ?? 'salesboat'
  const groupName = options.groupName ?? process.env.SALESBOAT_SHARED_GROUP ?? ownerName
  const identity = resolveSharedIdentity(ownerName, groupName)
  const summary = {
    owner: identity?.owner ?? '',
    group: identity?.group ?? '',
    chownCount: 0,
    chmodCount: 0,
    targets: []
  }

  for (const rawTargetPath of targetPaths) {
    const targetPath = path.resolve(rawTargetPath)
    summary.targets.push(targetPath)

    try {
      applyPathPermissions(targetPath, identity, summary)
    } catch (error) {
      console.warn(`[shared-perms] Failed to normalize ${targetPath}: ${error.message}`)
    }
  }

  return summary
}

// --- 脚本直接执行入口 ---
// 判断此文件是否被直接通过 `node` 命令执行。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // 如果是，则对 'public/gltf' 和 'dist' 目录执行权限修复。
  const summary = syncSharedPermissions([
    path.join(frontendDir, 'public', 'gltf'),
    path.join(frontendDir, 'dist')
  ])

  const ownerGroup = summary.owner && summary.group
    ? `${summary.owner}:${summary.group}`
    : 'current-user'

  console.log(
    `[shared-perms] normalized ${summary.targets.length} target(s) for ${ownerGroup}; chown=${summary.chownCount}, chmod=${summary.chmodCount}`
  )
}