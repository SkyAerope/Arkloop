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

在 Headless Linux 主机上，直接复制这一行：

```bash
sh -c 'set -e; arch="$(uname -m)"; case "$arch" in x86_64|amd64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; *) echo "unsupported architecture: $arch" >&2; exit 1 ;; esac; name="ark-linux-${arch}"; rm -rf "$name"; curl -fsSL "https://github.com/qqqqqf-q/Arkloop/releases/latest/download/${name}.tar.gz" | tar -xz; cd "$name"; exec ./ark web --host 0.0.0.0 --no-open'
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
