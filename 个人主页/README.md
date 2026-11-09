# 徐郭源 · 开源实践作品集

这是可直接用于 WorkBuddy 静态托管的个人主页发布包。

## 文件结构

```text
个人主页-发布版/
├─ index.html
├─ styles.css
├─ script.js
├─ favicon.svg
├─ assets/
└─ README.md
```

## 本地预览

在本目录打开 PowerShell，运行：

```powershell
python -m http.server 4173
```

然后访问 `http://localhost:4173/`。

也可以直接双击 `index.html`，但通过本地服务器预览更接近线上环境。

## WorkBuddy 发布

把 `个人主页-发布版` 文件夹内的全部文件上传到 WorkBuddy 静态网站项目，入口文件选择 `index.html`。`assets` 文件夹需要与 HTML 一起上传。

页面不依赖 CDN、外部字体或第三方 JavaScript；项目截图、认证图片和站点图标均保存在本地。

## 内容来源

- GitHub：`XZX-XYxy/xgy-KaiYuan`
- 本地目录：“开源微专业（周四）”中的课程材料与项目成果
- 项目数据：各项目 README、测试记录、扫描结果和设计方案
- 证书：`assets` 中的 HCIA-AI PDF、三项华为微认证 PDF 与开源通识认证
- 视频：`视频资料\片段2.mp4`，网页使用 `assets/fragment-2.mp4`
- 联系信息：邮箱 `19921243413@163.com`；未公开手机号

## 维护提示

- 项目链接直接指向 GitHub 仓库中的对应目录。
- 更新项目截图时，保持 `assets` 中的文件名不变即可。
- ThingsBoard 项目使用完整知识图谱截图，不裁切星球状图谱内容。
- HCIA-AI 主卡使用 `assets/hcia-ai-certificate.webp`，点击后打开原始 PDF。
- 三项微认证使用 WebP 缩略图展示，并分别链接到原始 PDF。
- 开源通识认证在 HCIA-AI 前独立成段展示。
- 微视频制作的封面来自片段 2 画面，视频不会自动播放。
- 新增项目可以复制 `.project-card` 结构，并补充 CSS 网格项。
- 证书或邮箱变更时，同步检查 `index.html` 内的相应链接和文本。
