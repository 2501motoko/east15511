# 吾一一事务所

基于 Next.js、Supabase 和 Vercel 的协作网站。包括课程资料、DDL 与活动、值日打卡、运动记录、风采照片墙和茶楼。茶楼设“学术”和“生活”分区；登录成员创建主题时可自由填写标签。访客可以免登录浏览；宿舍成员用学号和密码登录后可新增内容、打卡和参与讨论。管理员负责管理课程标签。数据库和文件均保存在 Supabase。

## 发布前需要准备

- GitHub 账号
- Vercel 账号（可用 GitHub 登录）
- Supabase 项目

## 配置 Supabase（首次部署一次）

1. 在 Supabase 创建一个项目。
2. 打开项目里的 **SQL Editor**，把本目录 `supabase/schema.sql` 的全部内容粘贴并运行一次。它会建立所需数据库表和私有文件桶，并初始化每周值日安排。若数据库已经按旧版代码初始化，运行 `supabase/tea_house.sql` 和 `supabase/duty_calendar.sql`，分别更新茶楼结构和每周值日安排。
3. 在项目顶部 **Connect** 复制 Project URL 和 Publishable key；在 **Project Settings → API Keys** 复制 Secret key。若使用新版密钥，将 Publishable key（`sb_publishable_…`）填入 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，Secret key（`sb_secret_…`）填入 `SUPABASE_SERVICE_ROLE_KEY`。也可以使用 Legacy API Keys 标签中的 anon / service_role。Secret key 只能放在服务器环境变量，不能公开或提交到 GitHub。
4. 在 Vercel 设置 `DORM_LOGIN_ACCOUNTS_JSON`，账号密码只放在此服务端环境变量中，不要写进源码。

## 上传到 GitHub

1. 解压项目压缩包。
2. 在 GitHub 新建空仓库。
3. 在仓库页面选择 **Add file → Upload files**，把解压后文件夹内的全部项目文件上传（不要只上传压缩包），然后提交。

## 在 Vercel 发布

1. 在 Vercel 选择 **Add New → Project**，导入刚才的 GitHub 仓库。
2. Framework 选择 Next.js（通常会自动识别），在 Environment Variables 添加：

   | 变量名 | 值 |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Publishable key（新版）或 anon key（旧版） |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secret key（新版）或 service_role key（旧版，保密） |
   | `DORM_LOGIN_ACCOUNTS_JSON` | 学号账号、密码及角色的 JSON 配置（仅服务端变量） |

3. 点击 **Deploy**。部署成功后打开分配的 `*.vercel.app` 网址。后续提交到 GitHub 的更改会自动触发 Vercel 重新部署。

## 本地运行

需要 Node.js 22.13 或更高版本、pnpm 11。复制 `.env.example` 为 `.env.local` 并填写上面的 Supabase 配置，然后运行：

```bash
pnpm install
pnpm dev
```

打开终端显示的本地网址。生产构建可运行 `pnpm build`。

## 管理和权限

- 登录方式是学号和密码。账号及角色由 Vercel 的 `DORM_LOGIN_ACCOUNTS_JSON` 配置；首次成功登录时，系统会在 Supabase Auth 中自动建立账号。
- JSON 格式示例：`{"学号":{"username":"赵英","password":"在 Vercel 设置的密码","role":"member"},"管理员学号":{"username":"王为钧","password":"在 Vercel 设置的密码","role":"admin"}}`。密码只在 Vercel 服务端变量填写。登录仍使用学号，网站中的成员身份只显示 `username`。不要把真实密码提交到 GitHub，也不要使用 `.env.example` 里的占位密码。
- `role` 为 `member` 的账号可以新增内容、参与讨论并编辑自己的记录；`role` 为 `admin` 的账号可以管理所有内容和成员权限。更新账号或密码后需在 Vercel 重新部署。
- 所有人都能免登录浏览公开内容。私密 DDL 和设为仅自己可见的运动记录仍只对创建者本人显示；课程资料和照片墙中的文件与照片可由任何访客查看或下载。
- 普通成员只能使用已存在的课程标签上传资料。
- DDL 日期必填、具体时间可选；活动可录入起止时间和地点。
- 值日使用月历视图；默认每周一王为钧、周三谢俞淇、周五赵英、周日刘佳。所有成员都可以新增、修改或删除每周排班规则，也可以点选当天的扫地、倒垃圾项目直接打卡。
- 运动打卡使用月历视图。每位成员的颜色保持固定，日期格显示用户名和时长，点击色条查看详情。记录可填写运动类型与时长，也可设为仅自己可见。
- 照片上传者可删除自己的照片，管理员可删除全部照片。
- 茶楼：学术、生活两个分区；成员可创建主题、自定义标签、发表帖子和回复。创建者可删除自己的主题或帖子，管理员可以管理所有主题和帖子。删除主题会一并删除其帖子与回复；回复最多一层，便于按帖子串联讨论。
- 茶楼主题分为“学术”和“生活”两个区；创建主题时可用中文或英文逗号添加多个自定义标签。

## 安全

不要把 `.env.local`、`DORM_LOGIN_ACCOUNTS_JSON`、Supabase Secret key / service_role key 或其他密钥上传到 GitHub。互动操作和上传仍由服务端验证成员登录；Secret key 只在服务器使用，不要把它改成 `NEXT_PUBLIC_` 变量。

## 故障排查

- 首页出现“公共数据接口暂时无法连接”时，这表示 Supabase 数据读取失败，不代表访客必须登录。确认 Vercel 已设置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 和服务器变量 `SUPABASE_SERVICE_ROLE_KEY`，并且已运行 `supabase/schema.sql`。旧数据库还应运行 `supabase/tea_house.sql` 与 `supabase/duty_calendar.sql`。值日周排班表缺失不会再阻断访客读取其他公开内容。
- 访客可浏览公开内容；登录只用于新增、打卡、讨论和其他互动。
