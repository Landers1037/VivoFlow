# 音乐专辑

音乐专辑是与照片相册、像素插画、音频可视化、时钟看板、黑洞互斥的首页模块。配置字段为 `music_album_enabled` 和 `active_music_album_id`，后端保存时会通过 `AppConfig::sanitize` 保证最多一个模块开启。`music_album_effect` 控制首页唱片周围的互斥特效：`off`、`ripple`、`bars`、`particles`、`turntable`，默认关闭。

## 本地存储

音乐专辑元数据保存于应用配置目录的 `music_albums.json`，每个专辑的封面和音频保存于 `music_albums/<album_id>/`。上传会校验媒体签名、大小和数量，删除专辑会清理其目录。

## API

- `GET/POST /api/music-albums`：列表、新建
- `PATCH/DELETE /api/music-albums/:id`：修改标题/循环播放/默认静音，或删除
- `POST /api/music-albums/:id/enable`：启用专辑，自动停用其它首页模块
- `POST /api/music-albums/:id/cover`：上传封面
- `POST /api/music-albums/:id/tracks`：批量上传 MP3/WAV/OGG/M4A
- `PATCH/DELETE /api/music-albums/:id/tracks/:track_id`：编辑标题、歌词或删除曲目
- `GET /api/music-albums/:id/cover/content`、`.../tracks/:track_id/content`：媒体内容

歌词支持普通文本和 `[mm:ss.xx]` LRC 时间轴；首页播放器会根据当前播放时间高亮对应行。

专辑可配置 `loop_playback` 与 `default_muted`：循环播放开启后首页自动播放、唱片旋转，并在曲目结束后循环整张专辑；默认静音开启后以静音方式播放（浏览器对有声自动播放的限制较少）。浏览器仍可能要求用户先点击播放按钮才能开始有声音频。
