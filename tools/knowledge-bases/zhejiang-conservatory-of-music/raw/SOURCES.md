# 浙江音乐学院 · 原始资料来源表

抓取日期：2026-08-13。类别编号：1简介 2院系/教学单位 3专业 4学科 5科研平台 6办学条件 7校训理念 8领导/机构 9招生 10规模。

| 文件 | 来源 URL | 层级 | 发布时间 | 抓取时间 | 覆盖类别 |
| --- | --- | --- | --- | --- | --- |
| 2026-08-13-school-profile.md | https://www.zjcm.edu.cn/zygk/zygk-xyjj/index.html | official | 2026-05（文末） | 2026-08-13 | 1,2,3,4,5,6,7,9,10 |
| 2026-08-13-school-profile-xxgk.md | https://xxgk.zjcm.edu.cn/jbxx/xxgk/202510/48885.html | official | 2025-09-12 | 2026-08-13 | 1,2,3,4,5,6,7,9,10 |
| 2026-08-13-charter.md | https://zjcm.edu.cn/zygk/zygk-xyzc/index.html | official | unknown（正文：2021年修订核准稿） | 2026-08-13 | 1,4,7,8 |
| 2026-08-13-campus-spirit.md | https://zjcm.edu.cn/zygk/zygk-xywh/xyjs/index.html | official | unknown | 2026-08-13 | 7 |
| 2026-08-13-leadership.md | https://zjcm.edu.cn/zygk/zygk-xrld/index.html | official | unknown | 2026-08-13 | 8 |
| 2026-08-13-leadership-xxgk.md | https://xxgk.zjcm.edu.cn/jbxx/xxgk/202510/48894.html | official | 2025-09-12 | 2026-08-13 | 8 |
| 2026-08-13-organization-xxgk-stub.md | https://xxgk.zjcm.edu.cn/jbxx/xxgk/202510/48889.html | official | 2025-09-12 | 2026-08-13 | 8（仅跳转，目标 404） |
| 2026-08-13-grading-center-profile.md | https://kjzx.zjcm.edu.cn/ | official | 2022-09-14（文末） | 2026-08-13 | 1,2,3,4,5,6,7,9,10 |
| 2026-08-13-graduate-admissions-2026.md | https://www.zjcm.edu.cn/zsjy/zsjy-zsw/202509/65692.html | official | 2025-09-30 | 2026-08-13 | 1,2,3,4,5,6,7,9 |
| 2026-08-13-undergraduate-admissions-charter-2026.md | https://www.zjcm.edu.cn/attachment/20260520/7bcc8385380cbf0283e15746fd240292.pdf | official | 2026-05-20 | 2026-08-13 | 3,9 |
| 2026-08-13-undergraduate-majors-catalog-2026.md | https://www.zjcm.edu.cn/attachment/20251223/03f004604249fc7042b814308be7af2c.pdf | official | 2025-12-23 | 2026-08-13 | 2,3,9 |
| 2026-08-13-undergraduate-admissions-brochure-page.md | https://zjcm.edu.cn/zyxw/tzgg/202601/66939.html | official | 2026-01-02 | 2026-08-13 | 9 |
| 2026-08-13-english-profile.md | https://english.zjcm.edu.cn/about/profile/index.html | official | 2024-09-30（文末） | 2026-08-13 | 1,2,3,4,5,6,7,9,10 |

## 抓取失败

| URL | 原因 |
| --- | --- |
| https://www.zjcm.edu.cn/xywz/zygk/jgsz/index.html | HTTP 404（信息公开网「机构设置」给出的跳转） |
| https://www.zjcm.edu.cn/xywz/rcpy/yjsjy/202510/48914.html | HTTP 404（搜索结果中的研究生处镜像地址） |
| https://english.zjcm.edu.cn/ | TLS 证书过期；改用 `curl -k` 后首页 200，简介正文在 /about/profile/index.html |
| https://kjzx.zjcm.edu.cn/ | TLS 证书过期；改用 `curl -k` 后 200 |
| https://www.zjcm.edu.cn/attachment/20260102/f2a5ce9e2f5dd69649bb5ea187786383.pdf | 文件下载成功，但是图片型 PDF，`pdftotext` 无文字 |

## 覆盖缺口

- **8 行政机构完整名单**：信息公开网只有失效跳转，未拿到职能部门清单。教学单位 18 个名单已从简介/研招简章拿到。
- **3 本科专业完整招考方向表**：专业目录 PDF 已保存，但双栏水印导致 `pdftotext` 行序错乱；招生简章 PDF 无法抽字。
- 章程、校园精神页未标注发布日期。
