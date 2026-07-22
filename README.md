# FerroScope｜铁死亡情报站

这是一个面向脂质生化研究者的可部署情报网站。它不是按论文数量做排行榜，而是把信息分成四类：核心机制、技术与化学、疾病与转化、相邻战略方向。

## 本地打开

需要 Node.js 18 或更高版本。

```bash
npm start
```

然后访问 `http://127.0.0.1:4173`。不要直接双击 `index.html`，因为浏览器会阻止本地页面读取 JSON 数据。

## 刷新一手数据

```bash
npm run update
npm run check
```

更新脚本读取：

- PubMed：同行评议原创论文；
- 预印本：通过 Crossref 的 `posted-content` 索引读取最近 90 天记录，再过滤 ferroptosis 标题；
- ClinicalTrials.gov：登记中带有 ferroptosis 的研究。

人工精选内容在 `data/intelligence-curated.json`，自动结果在 `data/live.json`。二者分开保存，自动任务不会覆盖人工判断。

`data/watch-queries.json` 保存重点实验室的“作者＋机构”定向检索。第一版接入 15 个与你的脂质生化方向最相关的团队；其余团队先保留官网观察，避免常见姓名造成作者误认。

## “实时”的准确含义

本项目是近实时情报站，不是秒级行情系统。PubMed、bioRxiv 和 ClinicalTrials.gov 本身按各自节奏更新。部署到 GitHub 后，`.github/workflows/refresh-intelligence.yml` 每 6 小时运行一次，并把更新后的 JSON 提交回仓库。

实验室官网结构差异很大，且经常改版。第一版不做脆弱的全网爬虫，而采用：

1. 官网直达；
2. 目标作者的 PubMed 自动监控；
3. 人工更新团队动态与风险提示。

## 证据等级

- A：独立团队收敛证据、正式方法共识，或强正交验证；
- B：高质量同行评议原创研究，通常仍需外部重复；
- C：预印本、早期临床试验或存在待解决可靠性问题的论文；
- D：观察性/间接临床研究，不能证明 ferroptosis 是人体机制。

## 部署

仓库已经包含两条 GitHub Actions：

- `deploy-pages.yml`：每次 `main` 更新后部署 GitHub Pages；
- `refresh-intelligence.yml`：每 6 小时聚合一次一手来源，数据有变化时提交回仓库，随后自动触发 Pages 重新部署。

首次部署时，在 GitHub Pages 设置中选择 **GitHub Actions** 作为 Source。工作流只把网站文件与 `data/` 上传到 Pages，不会把更新脚本部署到网页目录。

## 重要限制

- 自动筛选是导航工具，不替代阅读原文；
- 标题包含 ferroptosis 不等于证据充分；
- 临床试验搜索结果多数是观察性或伴随标志物研究；
- Lab 分类按当前主要能力设置，不代表团队只做一个方向；
- 任何 Editor’s Note、Correction、Retraction 都应在引用前重新核对。
