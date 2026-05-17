package main

import (
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// 注册前端静态资源和页面的路由规则
func (a *app) registerFrontendRoutes(mux *http.ServeMux) {
	//1. 挂载 /assets/ 静态资源目录
	// 用途：通常用于支持打包后的前端代码（如 Vue/React 编译出的 js、css、图片等）。
	//
	// filepath.Join(a.distDir, "assets")：定位到本地磁盘上存放打包文件的绝对路径（例如：/app/dist/assets）。
	// http.Dir(...)：把该本地路径转换成 Go 能够读取的文件系统目录。
	// http.FileServer(...)：创建一个静态文件服务器。
	//
	// 关键点 http.StripPrefix（去除前缀）：
	// 当浏览器请求 http://localhost:8080/assets/main.js 时，如果不做处理，Go 会去本地寻找/app/dist/assets/assets/main.js
	// （多了一层 assets 导致 404）。
	// StripPrefix("/assets/", ...) 的作用是在文件服务器查找前，把请求路径里的 /assets/ 砍掉，变成 main.js，
	// 这样文件服务器就能准确在 /app/dist/assets/ 下找到 main.js 了。
	mux.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir(filepath.Join(a.distDir, "assets")))))
	//
	mux.Handle("/gltf/", http.StripPrefix("/gltf/", http.FileServer(http.Dir(a.publicDir))))
	//
	mux.Handle("/pdf/", http.StripPrefix("/pdf/", http.FileServer(http.Dir(filepath.Join(a.repoRoot, "pdf")))))
	//兜底路由与 SPA 历史模式（History Mode）支持
	// 用途：这是最关键的兜底路由（Catch-All Route）。在 Go 的 http.ServeMux 中，/ 匹配所有没有被精确匹配到的路径。
	//
	// 为什么这么做：因为现代前端框架（如 Vue Router / React Router）普遍使用 HTML5 History 模式。
	// 当用户刷新 http://localhost:8080/dashboard 或者 http://localhost:8080/setting 时，后端其实并没有这些真实的静态目录。
	// 如果没有这行兜底，后端会直接返回 404。
	//
	// 处理逻辑：这里它把请求交给了 a.handleFrontendRequest 方法。在这个方法内部，其核心逻辑通常是：无视用户当前具体的 URL 路径，
	// 一律返回 Vue/React 编译生成的 dist/index.html 文件。浏览器拿到 index.html 运行其中的 JS 代码后，前端路由会自动接管并
	// 展示正确的 Dashboard 或 Setting 页面。
	mux.HandleFunc("/", a.handleFrontendRequest)
}

func (a *app) handleFrontendRequest(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		http.NotFound(w, r)
		return
	}

	indexPath := filepath.Join(a.distDir, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "frontend build not found; run `cd frontend && npm run build` before starting the Go server", http.StatusServiceUnavailable)
			return
		}

		http.Error(w, fmt.Sprintf("resolve frontend build: %v", err), http.StatusInternalServerError)
		return
	}

	// 当用户直接访问网站根路径时，服务器直接读取本地的网页首页文件（通常是 index.html）并响应给浏览器。
	if r.URL.Path == "/" {
		// 将本地文件高效地传输给浏览器。
		//
		// http.ServeFile(w, r, indexPath)在底层自动帮你处理了非常多的工业级细节：
		// ** 自动设置 Content-Type：它会读取 indexPath 对应的文件后缀（如 .html），然后在响应头里自动
		// 加上 Content-Type: text/html; charset=utf-8。这样浏览器就知道这届数据该按网页来渲染，
		// 而不是当成纯文本下载。
		// ** 支持断点续传（Range Requests）：如果用户下载大文件，它支持按字节范围请求（HTTP 206 状态码）。
		// ** 自动处理缓存优化（If-Modified-Since / ETag）：它会检测文件的修改时间。如果文件没变，它会自
		// 动向浏览器返回 304 Not Modified 状态码，让浏览器直接读本地缓存，从而极大节省服务器带宽。
		http.ServeFile(w, r, indexPath)
		return
	}

	// 第三关：绝对路径安全防御（防黑客越界）
	// 防范路径穿越攻击（Directory Traversal）：黑客可能会发送类似于 /../../../../etc/passwd 的请求，企图读取你服务器上的核心机密文件。

	// ** path.Clean：净化路径，消除其中的 . 或 ..。
	// ** filepath.FromSlash：跨平台转换，在 Windows 上把 / 转成 \。
	// ** isWithinBaseDirectory：这是一个自定义安全校验函数，用来确保计算出来的最终文件路径 requestedPath，
	//    必须乖乖呆在 a.distDir（前端编译目录）里面。如果发现超出了这个边界，立刻判定为非法请求，返回 400 Bad Request。
	cleanedPath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	requestedPath := filepath.Join(a.distDir, filepath.FromSlash(cleanedPath))
	if !isWithinBaseDirectory(a.distDir, requestedPath) {
		http.Error(w, "invalid frontend asset path", http.StatusBadRequest)
		return
	}

	// 对请求的路径进行三重判断：
	fileInfo, err := os.Stat(requestedPath)
	switch {
	// 情况 A：是个文件，且真实存在
	case err == nil && !fileInfo.IsDir():
		http.ServeFile(w, r, requestedPath)
		return
		// 情况 B：是个目录，且真实存在
	case err == nil && fileInfo.IsDir():
		nestedIndexPath := filepath.Join(requestedPath, "index.html")
		if nestedInfo, nestedErr := os.Stat(nestedIndexPath); nestedErr == nil && !nestedInfo.IsDir() {
			http.ServeFile(w, r, nestedIndexPath)
			return
		}
		// 情况 C：既不是文件也不是目录，且不是因为“找不到”引起的（比如磁盘坏了等系统错误）
	case err != nil && !os.IsNotExist(err):
		http.Error(w, fmt.Sprintf("resolve frontend asset: %v", err), http.StatusInternalServerError)
		return
	}

	// 终极兜底（完美支持 SPA History 模式）
	// 逻辑：如果上面的所有 case 都没中（也就是 os.IsNotExist(err) 成立，说明文件在磁盘上压根不存在）。
	// 举例：用户在 Vue 页面里刷新了浏览器，此时请求的 URL 路径是 /dashboard/settings。磁盘上当然没有一个叫 settings 的文件或文件夹。
	// 破局：代码不抛出 404，而是使出最后一招——依然把最外层的 index.html 返回给浏览器。浏览器拿到 index.html 后，
	// 里面的 JavaScript 路由代码（Vue Router）启动，会自动识别出当前地址栏是 /dashboard/settings，
	// 随后在前端把“设置页面”渲染出来。
	http.ServeFile(w, r, indexPath)
}
