---
title: 安装
description: 在你的平台上下载和安装 Arkloop。
---

## 下载

从 [Arkloop 官网](https://arkloop.ai) 下载对应平台的安装包。

| 平台 | 格式 |
|------|------|
| macOS | `.dmg` |
| Windows | `.exe` |
| Linux | `.AppImage` / `.deb` / `.rpm` |

## 安装

### macOS

打开 DMG → 将 Arkloop 拖入 Applications 文件夹。

首次启动时 macOS 会阻止未签名应用：

右键点击应用 → 打开 → 打开

> [!TIP] 如果"打开"按钮没有出现，在系统设置 → 隐私与安全性中点击"仍要打开"。

### Windows

运行 `.exe` 安装程序，按提示完成安装。

Windows SmartScreen 可能弹出"未识别的应用"提示：

点击"更多信息" → "仍要运行"

### Linux

根据发行版选择对应格式：

| 格式 | 使用方式 |
|------|----------|
| AppImage | `chmod +x` 后直接运行 |
| deb | `sudo dpkg -i arkloop.deb` |
| rpm | `sudo rpm -i arkloop.rpm` |

## 首次启动

安装后首次打开 Arkloop，以下步骤会自动完成：

- 下载 sidecar 二进制
- 创建本地数据库
- 加载内置 Agent

无需手动操作，等待进度条走完即可进入设置向导。

## 命令行

桌面端首次启动时可以安装 `ark` 命令行工具，也可以在设置 -> 更新里手动安装。安装后可以不打开桌面窗口，直接启动同一套本地运行时：

```bash
ark web
```

在 Headless 主机上，可以从 GitHub Releases 下载独立的 `ark-linux-*.tar.gz` 压缩包，解压后运行：

```bash
tar -xzf ark-linux-amd64.tar.gz
cd ark-linux-amd64
./ark web --host 0.0.0.0 --no-open
```

如果要在 VPS 上部署 Docker 自托管服务，克隆仓库并运行安装器：

```bash
git clone https://github.com/qqqqqf-q/Arkloop.git
cd Arkloop
chmod +x ./setup.sh
./setup.sh doctor
./setup.sh install --prod --profile standard --mode self-hosted --memory none --sandbox none --console lite --browser off --web-tools builtin --gateway on --non-interactive
```

## 全局快捷键

`Cmd+Shift+A`（macOS）/ `Ctrl+Shift+A`（Windows/Linux）可随时唤起或隐藏窗口，即使窗口已最小化。

## 系统托盘

Arkloop 最小化后收至系统托盘。托盘图标右键菜单提供：

- 显示窗口
- 打开设置
- 退出应用

## 关闭行为

默认关闭窗口时应用保持后台运行（托盘图标仍在）。如需关闭即退出，可在设置中切换此行为。
