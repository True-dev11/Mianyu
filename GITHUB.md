# 上传到 GitHub

建议使用**私有仓库**（Private），这个应用是个人睡眠工具，没必要公开。仓库里只有示例数据，没有你的真实睡眠记录。

## 最重要的规则

**不要把签名 keystore、密码或本机路径提交到 GitHub。**

本项目的 `.gitignore` 已经排除了：

- `release/mianyu.keystore`
- `android/keystore.properties`（本地签名密码）
- `android/local.properties`（本机 SDK 路径）
- `android/app/build/`、`android/.gradle/` 等构建产物
- `*.apk`

提交前可以检查：

```powershell
git status
git check-ignore -v release/mianyu.keystore release/Mianyu-0.2.0.apk android/keystore.properties android/local.properties
```

上面这些文件如果没有出现在 `git status` 里，就对了。

## 方式 A：网页创建仓库 + Git 命令（推荐）

本机已经装好 Git，并已在 `D:\dsh\sleep-app` 初始化仓库、提交代码。只剩创建远程仓库和推送。

1. 打开 <https://github.com/new>
2. Repository name 填 `mianyu-sleep-diary`（或你喜欢的名字）
3. 选择 **Private**
4. **不要**勾选 “Add a README file / Add .gitignore / Choose a license”，保持空仓库
5. 点 Create repository

创建后，把页面上的 HTTPS 地址复制下来，替换下面命令里的 `<你的用户名>`：

```powershell
cd D:\dsh\sleep-app
git remote add origin https://github.com/<你的用户名>/mianyu-sleep-diary.git
git branch -M main
git push -u origin main
```

第一次 push 时，Windows 通常会弹出浏览器让你登录 GitHub。登录后即可推送。

如果它要求输入密码：

- GitHub 不接受账号登录密码。
- 到 GitHub → Settings → Developer settings → Personal access tokens 创建一个 token，勾选 `repo` 权限。
- 在密码提示处粘贴这个 token（账号框仍填 GitHub 用户名）。

## 方式 B：GitHub CLI（少敲几条命令）

本机目前没有安装 `gh`。如果需要：

```powershell
winget install --id GitHub.cli
gh auth login
cd D:\dsh\sleep-app
gh repo create mianyu-sleep-diary --private --source=. --remote=origin --push
```

## 发布 APK

APK 是构建产物，不默认提交进 Git。推荐作为 **GitHub Release** 发布：

1. 打开仓库页面 → Releases → **Draft a new release**
2. Tag 填 `v0.2.0`
3. Title 填 `眠屿 0.2.0`
4. 把本机的 `release/Mianyu-0.2.0.apk` 拖进附件区域
5. Publish release

如果仓库是 Private，手机下载 Release 也需要登录对应 GitHub 账号。

也可以用命令行发布（需要先安装 GitHub CLI 并登录）：

```powershell
gh release create v0.2.0 release/Mianyu-0.2.0.apk --title "眠屿 0.2.0" --notes "首个安卓版本"
```

## 以后修改代码后

```powershell
cd D:\dsh\sleep-app
git add .
git commit -m "描述这次改了什么"
git push
```

如果要更新 APK：

```powershell
.\build-apk.ps1
```

然后递增 `android/app/build.gradle` 里的 `versionCode`，重新打 Release。升级 APK 必须继续用本地同一把 keystore 签名，否则无法覆盖安装。

## 常见问题

**push 报 `remote origin already exists`**

```powershell
git remote set-url origin https://github.com/<你的用户名>/mianyu-sleep-diary.git
```

**push 报权限不足**

确认仓库地址、用户名和 token 权限；私有仓库需要 `repo` 权限。

**怕上传错文件**

先运行 `git status`，只 add 你确认过的源码、文档和截图；一定不要在输出里看到 keystore、`keystore.properties`、`local.properties` 或 `*.apk`。

如果误把 keystore 或密码提交并推送了，应该立即重新生成一套签名 key，并撤销泄露的 token。
