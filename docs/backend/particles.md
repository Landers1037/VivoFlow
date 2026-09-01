# 粒子图片存储

`particle.rs` 管理粒子系统使用的原图库。元数据保存在配置目录 `particles.json`，原图保存在共享媒体根路径的 `particles/` 分类；媒体根路径迁移会包含该分类。

接口：

- `GET /api/particles`：图库与当前图片。
- `POST /api/particles/images`：multipart 字段 `images`，JPEG/PNG/WebP/AVIF，单张 25 MB，图库最多 50 张。
- `PUT /api/particles/active`：使用 `{ "id": "..." }` 选择当前图片。
- `DELETE /api/particles/images/{id}`：删除原图；删除当前图片时选择相邻项。
- `GET /api/particles/images/{id}/content`：返回原图内容。

元数据使用临时文件、备份和重命名提交；写入失败时恢复内存状态并清理本次创建的文件。
