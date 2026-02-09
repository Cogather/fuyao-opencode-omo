# 安装 Bun

fuyao-opencode 使用 [Bun](https://bun.sh) 作为运行时和包管理器。若尚未安装 Bun，可按以下方式安装。

## Windows（PowerShell）

在 **PowerShell** 中执行（推荐）：

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

安装完成后关闭并重新打开终端，执行 `bun --version` 验证。

## macOS / Linux

```bash
curl -fsSL https://bun.sh/install | bash
```

安装后根据提示将 Bun 加入 PATH（或重新打开终端），再执行 `bun --version` 验证。

## 其他方式

- **npm**：`npm install -g bun`
- **Homebrew（macOS/Linux）**：`brew install bun`
- **Docker**：`docker pull oven/bun`

## 验证

```bash
bun --version
```

版本号正常输出即表示安装成功。之后在项目根目录执行 `bun run build` 即可构建 fuyao-opencode。
