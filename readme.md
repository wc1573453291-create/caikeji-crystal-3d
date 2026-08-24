# 材科基 3D 晶体结构库

一个面向《材料科学基础》教学的纯静态 3D 晶体结构网页。项目使用 HTML + CSS + JavaScript + 3Dmol.js 实现，无后端。

## 使用方式

直接打开 `index.html` 即可使用。3Dmol.js 已随项目本地提供，不依赖外部 CDN。

## 部署

项目通过 GitHub Pages 自动部署。每次向 `main` 分支推送更新，`.github/workflows/deploy-pages.yml` 会发布仓库根目录中的静态网页。

同时可部署到 Cloudflare Workers Static Assets。Cloudflare 的构建命令设为 `node scripts/build-static.mjs`，部署命令保持 `npx wrangler deploy`；每次向 `main` 推送更新后，Cloudflare 会发布 `dist` 中生成的静态站点。

Cloudflare Pages 镜像使用相同的构建命令，输出目录设为 `dist`，生产分支设为 `main`。

## 当前内容

- 空间点阵：按三斜、单斜、正交、六方、菱方、四方、立方顺序排列的 14 种布拉菲点阵
- 金属晶体：FCC、BCC、HCP
- 固溶体：置换固溶体、间隙固溶体
- 离子晶体：CsCl、NaCl、CaF<sub>2</sub>、钙钛矿、立方 ZnS（闪锌矿）、六方 ZnS（纤锌矿）、TiO<sub>2</sub>（金红石）和 MgAl<sub>2</sub>O<sub>4</sub>（尖晶石）结构
- 化学式中的计量数自动显示为下标，离子价态以及 r<sup>+</sup>、r<sup>-</sup> 自动显示为上标
- 共价晶体：金刚石结构

## 交互功能

- 手机优先布局，适配手机浏览器、微信内置浏览器、电脑 Chrome
- 单指旋转、双指缩放、三指平移
- 分类切换与结构切换
- 空间点阵按 7 大晶系分组，并在知识卡片中显示晶格常数关系
- 空间点阵立体图中显示 a、b、c 和 α、β、γ 角度弧形标注
- 金属、离子、共价晶体知识卡片显示点阵类型、原子/离子数、配位数、半径关系等考点
- 知识卡自动隐藏空白、未讨论或不需要标注的项目
- 固溶体仅显示晶胞框线和原子位置，不绘制容易混淆的球间连线
- 金属晶体 FCC、BCC、HCP 默认不绘制原子间连接线；可显示晶胞内全部四面体或八面体间隙，点选任一间隙查看配位多面体、二维尺寸图和逐步半径比推导，再次点选即可收起
- 显示/隐藏晶胞
- 显示/隐藏元素图例
- 球棍模型/空间填充模型切换
- 重置视角
- 1 个晶胞/2×2×2 晶胞切换
- 每个结构配有知识卡片：中文名、英文名、典型物质、配位数、致密度、考研重点、易错点、一句话记忆

## 文件结构

```text
index.html
css/style.css
js/app.js
js/crystalData.js
js/renderer.js
vendor/3Dmol-min.js
README.md
```

## 制作信息

网页制作：材料成哥。专注材料科学基础的可视化学习工具。
