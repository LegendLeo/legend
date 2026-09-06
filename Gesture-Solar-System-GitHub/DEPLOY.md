# 将手势太阳系发布到 GitHub Pages

这个项目使用 React、TypeScript 和 Vite。仓库保存源码，GitHub Actions 自动安装依赖、运行手势测试、构建网页并发布到 GitHub Pages。无需另购服务器。

你的仓库是 [LegendLeo/legend](https://github.com/LegendLeo/legend)，默认分支为 `main`，当前是公开仓库。检查时仓库中只有 `README.md`，Pages 尚未开启。

- [上传项目文件到 main](https://github.com/LegendLeo/legend/upload/main)
- [打开 Pages 设置](https://github.com/LegendLeo/legend/settings/pages)
- [查看和运行发布工作流](https://github.com/LegendLeo/legend/actions)
- 发布成功后的默认网址：**https://legendleo.github.io/legend/**

以上正式网址会在首次发布成功后生效。

## 1. 上传项目

推荐使用整理好的项目压缩包，解压后打开项目目录。在你的 GitHub 仓库中，点击 **Add file → Upload files**（空仓库可点 **uploading an existing file**）。将项目目录里面的文件和文件夹拖入上传区域，再点击 **Commit changes**。

上传完成后，仓库根目录应直接包含：

```text
.github/
  workflows/
    deploy.yml
.gitignore
src/
public/
  models/
  wasm/
tests/
index.html
package.json
package-lock.json
tsconfig.json
tsconfig.app.json
vite.config.ts
README.md
DEPLOY.md
```

确保 `.github` 文件夹也一起上传。不要把压缩包本身作为网站文件上传，也不要在仓库外面再套一层项目文件夹；打开仓库就应看到 `package.json`。

日常使用的项目目录中，`node_modules` 是已安装依赖，`dist` 是构建产物，`work` 是测试与临时文件，`outputs` 是交付文件。这些都已由 `.gitignore` 排除，整理好的上传包也已排除它们。`public/models` 和 `public/wasm` 必须保留，否则手势识别模型会缺失。

项目资源最大单文件约 10.64 MiB，符合 GitHub 网页上传的单文件大小限制。源码上传后由工作流生成网页，无需在本机上传 `dist`。

## 2. 开启 Pages

打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。

如果免费账户的私有仓库没有 Pages 选项，可以使用公开仓库；私有仓库的 Pages 可用性取决于 GitHub 账户方案。仓库是否公开由你在 GitHub 中设置。

## 3. 运行发布

打开仓库的 **Actions** 页，选择 **发布手势太阳系**，点击 **Run workflow**，选择仓库的默认分支，再运行。

首次上传可能早于 Pages 设置而触发一次失败，设置完成后重新运行即可。之后每次向默认分支提交更新，都会自动构建并发布。其他分支的提交不发布。

流程通常需要几分钟。`build` 和 `deploy` 两个任务都显示绿色后，在部署任务的链接或 **Settings → Pages** 中打开正式网站地址。

## 4. 打开正式网址

普通项目仓库的网址通常是：

```text
https://你的用户名.github.io/你的仓库名/
```

若仓库名恰好为 `你的用户名.github.io`，则网址通常是 `https://你的用户名.github.io/`。以 Pages 设置和发布结果中显示的地址为准。

部署工作流会读取 GitHub 提供的网站路径，并在构建时设置 Vite 的 `base`，无需手工把仓库名写进源码。脚本、样式、手势模型和 WASM 文件都会使用正确的网站路径。

## 摄像头使用

使用正式的 HTTPS 网址打开网页，点击 **开启**，并允许网站访问摄像头。权限按浏览器和网站分别保存，之前授予 localhost 的权限与正式网站独立。

先在其他打开的太阳系页面中暂停摄像头，再启动正式网站的相机，避免设备占用。界面本身是中文，不需要浏览器自动翻译；刷新旧页面可使用 `Ctrl+F5`。

摄像头和手势识别在浏览器中运行；GitHub Pages 负责提供网页与模型文件。

## 常见发布问题

- **页面 404**：先检查 Actions 的发布任务是否成功，再使用 Pages 给出的完整网址；普通项目网址包含仓库名。
- **“读取 Pages 地址”步骤失败**：检查 Settings → Pages 的 Source 是否已设置为 GitHub Actions，然后重新运行工作流。
- **手势模型加载失败**：确认仓库包含全部 `public/models` 和 `public/wasm` 文件，且相应资源在正式站点能够访问。
- **工作流跳过构建**：当前提交或手动运行选择的分支不是仓库默认分支。切换到默认分支运行。
- **发布等待审核**：按仓库的 `github-pages` 环境设置处理部署审核；工作流会遵守已有环境规则。
