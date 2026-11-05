# Apache Commons CSV 开源许可证审查

本仓库记录使用 ScanCode Toolkit 对 Apache Commons CSV 1.14.1 进行的开源许可证合规审查，包含最终报告、原始扫描结果和复现命令。

## 在线查看

- [ScanCode 检测结果首页](index.html)
- [最终审查报告](report/Apache-Commons-CSV-License-Audit-Report.docx)
- [HTML 原始报告](scan-results/commons-csv-1.14.1-scan.html)
- [CSV 检测结果](scan-results/commons-csv-1.14.1-scan.csv)
- [JSON 检测结果](scan-results/commons-csv-1.14.1-scan.json)

如果仓库已启用 GitHub Pages，根目录的 `index.html` 可以直接作为在线检测报告打开。

## 审查对象

- 项目：Apache Commons CSV
- 组织：Apache Software Foundation
- GitHub：https://github.com/apache/commons-csv
- 版本：`rel/commons-csv-1.14.1`
- 提交：`e14ef86d34211f9d1b9b6040c5f6dbafc93ba907`
- 项目许可证：`Apache-2.0`

## 审查工具

- ScanCode Toolkit：`32.5.0`
- 输出格式版本：`4.1.0`
- SPDX 许可证清单：`3.27`
- Python：`3.13.15`
- 运行环境：Windows 11 x64

## 扫描结果

- 扫描范围：118 个文件、45 个目录，共 42.10 MB
- 扫描异常：0 个
- Maven 包：1 个
- 直接依赖声明：8 个
- 检出许可证表达：89 个文件
- Apache-2.0 检出：87 个文件
- CLA 上下文复合表达：2 个文件
- Java 文件：54 个，全部检出 Apache-2.0
- XML 文件：15 个，全部检出 Apache-2.0
- 其他许可证或第三方源码：未发现

README 和 CONTRIBUTING 中的 `generic-cla` 是贡献者许可协议提示，不是额外的代码许可证。未检出许可证文本的文件主要是测试 CSV、TSV、空资源和发布说明，受仓库根目录 `LICENSE.txt` 覆盖。

## 使用结论

Apache Commons CSV 1.14.1 可用于个人学习、内部系统和闭源商业项目。对外分发时应：

- 提供 Apache-2.0 许可证文本
- 保留 `NOTICE.txt` 中的版权与归属信息
- 修改并分发源码时标明修改过的文件
- 不使用 Apache 或 ASF 名称暗示官方背书
- 对最终产品的完整依赖树另行生成 SBOM 或许可证清单

本仓库提供的是技术合规审查结果，不构成正式法律意见。

## 复现

完整克隆和扫描命令见 [evidence/scan-command.txt](evidence/scan-command.txt)。

## 文件校验

交付文件的 SHA-256 校验值见 [SHA256SUMS.txt](SHA256SUMS.txt)。

## 隐私说明

最终 DOCX 封面包含学生姓名、班级和学号。如果仓库公开，请先确认这些个人信息是否适合公开；也可以改用私有仓库提交。
