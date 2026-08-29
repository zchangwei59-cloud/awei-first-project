# 事故车维修进度记录

一款适合手机浏览器使用的轻量维修台账。支持登记车牌号、车型、工单号、维修项目、配件更换、外修状态、当前维修状态和备注，并将数据保存在浏览器本地。

## 使用方法

直接用浏览器打开 `index.html`，或在项目目录启动本地服务器：

```bash
python3 -m http.server 8000
```

然后访问 <http://localhost:8000>。填写带星号的必填信息后点击“保存维修记录”；可在下方搜索、编辑或删除记录。

> 数据使用 `localStorage` 存放在当前浏览器中。更换浏览器、使用无痕模式或清除网站数据后，原记录将无法读取。

## 发布到 GitHub Pages

仓库已包含自动发布工作流。将代码推送或合并到 GitHub 的 `main` 分支后，GitHub Actions 会自动发布网站。

首次发布时，请在仓库中依次打开 **Settings → Pages**，在 **Build and deployment** 下将 **Source** 设为 **GitHub Actions**。然后打开 **Actions → 发布到 GitHub Pages → Run workflow** 手动触发一次发布。

发布完成后，网页地址通常为：

```text
https://<你的-GitHub-用户名>.github.io/<仓库名>/
```
