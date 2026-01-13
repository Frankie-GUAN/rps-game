# 石头剪刀布 链游 (Web3)

简体中文说明 — 一个基于以太坊测试网（Sepolia）的石头剪刀布链上对战前端示例。

## 功能概览
- 前端页面：连接 MetaMask、选择出拳、输入投注与随机盐值、发起对战、显示结果与战绩。
- 使用 web3.js 与合约交互（需提供 abi.json 与已部署合约地址）。

## 运行环境
- Windows / 任意支持浏览器的系统
- 推荐浏览器：Chrome + MetaMask 扩展（切换到 Sepolia 测试网）
- Node / Python（用于本地静态服务器）

## 本地启动（任选其一）
1. 使用 Python（项目目录 e:\Rock_paper_scissors）：
   ```powershell
   cd e:\Rock_paper_scissors
   python -m http.server 8080
   ```
2. 使用 http-server（Node）：
   ```powershell
   cd e:\Rock_paper_scissors
   npx http-server -p 8080
   ```
然后在浏览器打开： http://localhost:8080

> 注意：不能直接用 file:// 打开 index.html（浏览器安全限制、MetaMask 不注入）。

## 必要配置
- 确保项目根目录包含 `abi.json`（合约 ABI）。
- 在 `app.js` 中确认并设置已部署合约的地址（contractAddress），并使用 Sepolia 测试网合约。

## 文件说明
- `index.html` — 页面结构与界面
- `style.css` — 页面样式（赛博朋克风）
- `app.js` — 前端逻辑：钱包连接、合约交互、游戏流程
- `abi.json` — 合约 ABI（必须存在以便调用合约）

## 提交到 Git 建议
- 在提交前确认 `abi.json` 中是否包含敏感信息（私钥等不应提交）。
- 可在 `.gitignore` 中排除本地配置或密钥文件。

## 常见问题
- 连接钱包无反应：请确保通过 http://localhost:8080 访问并已安装 MetaMask。
- ABI 加载失败：检查控制台（F12）是否有 fetch 错误，确保 `abi.json` 路径正确。
