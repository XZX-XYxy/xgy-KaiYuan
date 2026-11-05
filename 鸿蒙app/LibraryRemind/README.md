# LibraryRemind

LibraryRemind 是一个面向校园生活场景的 HarmonyOS 提醒卡片应用。

当前版本提供校园自习、晨读打卡和作业提交等提醒的展示、新增与删除功能，适合作为 ArkTS 声明式 UI 和 HarmonyOS Stage 模型的学习与比赛演示项目。

## 功能

- 打开页面时展示 3 条默认校园提醒
- 输入标题、时间和备注后新增提醒
- 标题为空时通过 Toast 提示用户
- 时间或备注为空时自动使用默认文案
- 按卡片右侧按钮删除对应提醒
- 实时显示当前提醒数量
- 列表支持滚动，适配手机屏幕

当前提醒数据保存在页面内存中。重新打开页面后，新增和删除操作不会保留。

## 技术栈

- HarmonyOS
- ArkTS
- ArkUI 声明式开发
- Stage 模型
- `@State` 状态管理
- `List`、`ForEach` 列表渲染
- `@system.prompt` Toast 提示
- Hypium 测试框架
- Hamock 模拟框架

## 运行环境

- DevEco Studio
- HarmonyOS SDK
- `targetSdkVersion`: `26.0.0`
- `compatibleSdkVersion`: `6.1.1(24)`

## 目录结构

```text
LibraryRemind/
├── AppScope/                  # 应用级配置、名称和图标资源
├── entry/                     # 主模块
│   ├── src/main/              # ArkTS 源码、页面、Ability 和资源
│   ├── src/test/              # 本地单元测试
│   ├── src/ohosTest/          # 设备测试
│   └── src/mock/              # 模拟配置
├── hvigor/                    # Hvigor 构建配置
├── build-profile.json5        # 应用构建配置
├── code-linter.json5          # 代码检查配置
├── oh-package.json5           # 项目依赖声明
├── oh-package-lock.json5      # 依赖版本锁定
└── hvigorfile.ts              # 构建任务入口
```

## 本地运行

1. 使用 DevEco Studio 打开项目根目录。
2. 等待 Hvigor 和依赖同步完成。
3. 在 DevEco Studio 中配置本地签名。
4. 选择一台 HarmonyOS 手机或模拟器运行 `entry` 模块。

签名证书、签名密码和本机 SDK 路径不应提交到仓库。项目已通过 `.gitignore` 排除本地配置、构建缓存、系统镜像和签名文件。

## 测试

测试代码位于：

- `entry/src/test/LocalUnit.test.ets`
- `entry/src/ohosTest/ets/test/Ability.test.ets`
- `entry/src/ohosTest/ets/test/List.test.ets`

当前测试主要验证 Hypium 测试框架的基本断言流程，后续可以为提醒新增、删除、空标题校验和默认文案补充业务测试。

## 后续可扩展方向

- 使用 Preferences、关系型数据库或云端服务持久化提醒
- 增加提醒时间选择和系统通知
- 支持编辑提醒
- 增加提醒分类、搜索和完成状态
- 增加页面截图和演示视频

