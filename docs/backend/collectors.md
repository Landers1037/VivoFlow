# collectors — 指标采集

**目录：** [`crates/vivoflow/src/collectors/`](../../crates/vivoflow/src/collectors/)

## 编排：`mod.rs`

`Collector` 聚合五个子采集器。`collect(&EnabledModules)` 按开关决定是否 `sample()`，组装带 `ts` 的 `Snapshot`。另维护 `temp_history`：CPU/内存温度约每 1 分钟记一点，最多 60 点（约 1 小时）。

## cpu.rs

| 能力 | 实现 |
|------|------|
| 核心数 / 型号 / 占用 | `sysinfo`（双次 refresh，避免首帧全 0） |
| 标称频率 | `Cpu::frequency()` |
| 当前运行频率 | Windows `CallNtPowerInformation(ProcessorInformation)`；失败则回退标称频率或 `null` |
| `load_5s` / `load_5m` / `load_15m` | 采集器内 `VecDeque` 滚动平均占用 % |
| 温度 | `thermal::cpu_temperature_c()`（性能计数器 / ACPI WMI，尽力而为） |

## memory.rs

| 能力 | 实现 |
|------|------|
| 总量 / 已用 / 占用% | `sysinfo` |
| 条级型号 / 频率 / 容量 | WMI `Win32_PhysicalMemory` |
| 温度 | `thermal::memory_temperature_c()`（匹配 MEM/DRAM 等热区名；多数主板不可用则为 `null`） |

WMI 字符串经 `clean_wmi_str` 过滤空串与 `"NULL"`。

## thermal.rs

| 能力 | 实现 |
|------|------|
| 热区枚举 | 优先 `Win32_PerfFormattedData_Counters_ThermalZoneInformation`，回退 `ROOT\WMI` 的 `MSAcpi_ThermalZoneTemperature` |
| 换算 | 十分之一开尔文 → °C；过滤不合理读数 |

## gpu.rs

| 能力 | 实现 |
|------|------|
| 型号 / AdapterRAM | WMI `Win32_VideoController`（过滤 Basic/远程/虚拟/Oray 等） |
| 占用 / 温度 / 时钟 / 显存用量 | `nvml-wrapper` 匹配或追加；初始化失败后本进程内不再重试 |

无 NVIDIA 时，Intel Arc 等可能仅有名称与部分显存字段，其余为 `null`。

## disk.rs

| 能力 | 实现 |
|------|------|
| 挂载点、容量、已用、介质类型 | `sysinfo::Disks` |
| 读写速率 | `Disk::usage()`（距上次 refresh 的字节差）/ 时间差 |
| 型号 | WMI `Win32_DiskDrive`（尽力匹配） |

## network.rs

| 能力 | 实现 |
|------|------|
| 接口流量差分 → bps | `sysinfo::Networks` |
| 过滤 | loopback / ISATAP / Teredo / vEthernet 等 |
| 型号 | WMI `Win32_NetworkAdapter`（物理且启用），名称模糊匹配 |

## 平台门控

WMI / NVML / PowerInformation 等路径使用 `#[cfg(windows)]`；非 Windows 构建对应能力返回空或 `None`。
