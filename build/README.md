# Build Assets

此目录包含构建所需的资源文件。

## 图标文件

需要以下图标文件（请替换为实际的IceCode图标）：

- `icon.ico` - Windows图标 (256x256或更大)
- `icon.icns` - macOS图标 
- `icon.png` - Linux图标 (512x512)

## 如何生成图标

### 从PNG生成所有格式

1. 准备一个512x512的PNG图标文件
2. 使用在线工具转换：
   - Windows ICO: https://convertio.co/zh/png-ico/
   - macOS ICNS: https://cloudconvert.com/png-to-icns
   
3. 将生成的文件放入此目录

### 推荐图标尺寸

- **Windows (.ico)**: 包含 16x16, 32x32, 48x48, 256x256
- **macOS (.icns)**: 包含 16x16 到 1024x1024 多种尺寸
- **Linux (.png)**: 512x512 或 1024x1024

## 临时方案

在添加真实图标之前，可以使用任何PNG图片重命名为上述文件名进行打包测试。
