# 拾跃事务所

基于 Next.js、Supabase 和 Vercel 的协作网站。包括课程资料、DDL 与活动、值日打卡、运动记录、风采照片墙和茶楼。茶楼设“学术”和“生活”分区；登录成员创建主题时可自由填写标签。访客可以免登录浏览；宿舍成员用邮箱登录后可新增内容、打卡和参与讨论。管理员负责管理成员和课程标签。数据库和文件均保存在 Supabase。

## 发布前需要准备

- GitHub 账号
- Vercel 账号（可用 GitHub 登录）
- Supabase 项目

## 配置 Supabase（首次部署一次）

1. 在 Supabase 创建一个项目。
2. 打开项目里的 **SQL Editor**，把本目录 `supabase/schema.sql` 的全部内容粘贴并运行一次。它会建立所需数据库表和私有文件桶。若数据库已经按旧版代码初始化，重新运行 `supabase/tea_house.sql`，它会为茶楼增加分区和标签字段，并把已有主题归入“学术”区。
3. 在项目顶部 **Connect** 复制 Project URL 和 Publishable key；在 **Project Settings → API Keys** 复制 Secret key。若使用新版密钥，将 Publishable key（`sb_publishable_…`）填入 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，Secret key（`sb_secret_…`）填入 `SUPABASE_SERVICE_ROLE_KEY`。也可以使用 Legacy API Keys 标签中的 anon / service_role。Secret key 只能放在服务器环境变量，不能公开或提交到 GitHub。
4. 在 **Authentication → URL Configuration** 设置 Site URL 为你的 Vercel 网址；在 Redirect URLs 添加 `https://你的域名/auth/callback`。若要从 Vercel 预览部署登录，也添加对应预览地址的 `/auth/callback`。
5. 邮件登录链接由 Supabase Auth 发送。发布后先用 `DORM_ADMIN_EMAIL` 指定的邮箱登录；管理员可在页面中添加室友邮箱。

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
   | `DORM_ADMIN_EMAIL` | 你的管理员登录邮箱 |

3. 点击 **Deploy**。部署成功后打开分配的 `*.vercel.app` 网址。后续提交到 GitHub 的更改会自动触发 Vercel 重新部署。

## 本地运行

需要 Node.js 22.13 或更高版本、pnpm 11。复制 `.env.example` 为 `.env.local` 并填写上面的 Supabase 配置，然后运行：

```bash
pnpm install
pnpm dev
```

打开终端显示的本地网址。生产构建可运行 `pnpm build`。

## 管理和权限

- 管理员邮箱由 `DORM_ADMIN_EMAIL` 决定；该邮箱首次登录时会自动获得管理员权限。
- 管理员登录后，在“课程资料”页面的“宿舍成员管理”输入邮箱并添加。该成员收到登录链接后即可参与互动；普通成员可以新增内容并编辑或删除自己的记录，管理员可以管理所有内容。
- 所有人都能免登录浏览公开内容。私密 DDL 和设为仅自己可见的运动记录仍只对创建者本人显示；课程资料和照片墙中的文件与照片可由任何访客查看或下载。
- 普通成员只能使用已存在的课程标签上传资料。
- DDL 日期必填、具体时间可选；活动可录入起止时间和地点。
- 值日需要倒垃圾、扫地两项都完成才算打卡成功。
- 运动记录可以只打卡，也可以填写类型、时长和日期，并可设为仅自己可见。
- 照片上传者可删除自己的照片，管理员可删除全部照片。
- 茶楼：学术、生活两个分区；成员可创建主题、自定义标签、发表帖子和回复。创建者可删除自己的主题或帖子，管理员可以管理所有主题和帖子。删除主题会一并删除其帖子与回复；回复最多一层，便于按帖子串联讨论。
- 茶楼主题分为“学术”和“生活”两个区；创建主题时可用中文或英文逗号添加多个自定义标签。

## 安全

不要把 `.env.local`、Supabase Secret key / service_role key 或其他密钥上传到 GitHub。互动操作和上传仍由服务端验证成员登录；Secret key 只在服务器使用，不要把它改成 `NEXT_PUBLIC_` 变量。
