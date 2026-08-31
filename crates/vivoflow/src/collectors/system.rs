use sysinfo::System;

use crate::models::SystemMetrics;

/// Collects host identity once and refreshes uptime for every snapshot.
pub struct SystemCollector {
    host_name: Option<String>,
    os_name: Option<String>,
    os_version: Option<String>,
    kernel_version: Option<String>,
}

impl SystemCollector {
    pub fn new() -> Self {
        Self {
            host_name: System::host_name(),
            os_name: System::name(),
            os_version: System::long_os_version().or_else(System::os_version),
            kernel_version: System::kernel_version(),
        }
    }

    pub fn sample(&self) -> SystemMetrics {
        SystemMetrics {
            host_name: self.host_name.clone(),
            os_name: self.os_name.clone(),
            os_version: self.os_version.clone(),
            kernel_version: self.kernel_version.clone(),
            uptime_seconds: System::uptime(),
        }
    }
}

impl Default for SystemCollector {
    fn default() -> Self {
        Self::new()
    }
}
