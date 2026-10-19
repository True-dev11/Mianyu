# 眠屿 0.2.0 · Android APK

## 安装包

> GitHub 仓库默认不提交 APK 和签名 key；APK 作为 GitHub Release 附件发布，或从本项目本地 `release/` 目录获取。

- 文件：`Mianyu-0.2.0.apk`
- 版本：0.2.0（versionCode 2）
- 包名：`com.mianyu.sleepdiary`
- 大小：151,015 字节（约 148 KB）
- 支持：Android 6.0+（minSdk 23），targetSdk 35
- SHA-256：`DA49972BA2F478C2BF2E3A4C7F86805B016795494D9AE79EDF74D52F43A43EEA`
- 签名证书 SHA-256：`9A06BBFC057F756CAC9F5B4C0821394319473DAFEBEFAC796AF33608365AC243`

安装：

1. 把 APK 传到手机（数据线、网盘或聊天工具都可以）。
2. 点击 APK；首次安装需要允许“安装未知来源应用”。
3. 应用名是“眠屿”，图标是本机的紫底月牙。

## 首次使用注意

- APK 的数据和网页测试的数据是**分开的**，网页里的记录不会自动带过来。
- 首次打开会载入 420 晚示例数据，方便看月历和趋势。开始记录真实睡眠前，请到 **设置 → 数据 → 清空示例**。
- 数据保存在应用自己的 WebView 本地存储中。卸载、清除应用数据或换手机会丢失，请定期到 **设置 → 数据 → 导出备份**。
- 导入/导出使用安卓系统文件选择器，不需要存储权限。

## AI

- 在 **设置 → AI 深度解读** 填自己的 OpenAI 兼容接口。
- APK 通过原生 HTTP 请求访问 API，不受网页版 CORS 限制。
- 支持 `http(s)` 地址；非 HTTPS 建议只用于可信的局域网服务。
- API Key 只保存在应用本地；导出的备份不包含 Key。
- 分析请求只发送睡眠统计与最近记录，不包含备注和昵称。

## 权限与隐私

- 只申请 `INTERNET` 权限。
- 不包含广告、统计或第三方 SDK。
- 不读取通讯录、相册、定位或外部存储。

## 签名与升级

- Keystore：`mianyu.keystore`（RSA 2048，有效期 10000 天）
- Alias：`mianyu`
- **密码不在仓库中**。签名配置放在本机的 `android/keystore.properties`，该文件和 keystore 都被 `.gitignore` 排除。
- 后续升级必须使用同一把 keystore，并把 `versionCode` 加 1，才能覆盖安装。
- 请把 keystore 和密码单独备份到密码管理器；丢失后无法给已安装的版本做覆盖升级。
- 克隆仓库后，如需自行构建：复制 `android/keystore.properties.example` 为 `android/keystore.properties`，填入你的签名信息。

## 构建

```powershell
cd <项目目录>
.\build-apk.ps1
```

脚本会先把网页源码同步到 `android/app/src/main/assets/www/`，再用本地 Gradle、JDK 21、Android SDK 构建签名 APK，并校验签名。

## 验证说明

已通过：Gradle release 构建、APK 签名校验、manifest/包名/版本检查、资源与网页打包检查，以及网页回退与模拟原生桥接的 AI、导入导出、返回键流程测试。

当前环境没有连接安卓手机或安装模拟器，因此还未进行真机安装运行；若安装或启动遇到问题，请把具体现象告诉我，我会直接修复并重新出包。
