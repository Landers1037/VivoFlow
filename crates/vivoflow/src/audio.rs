use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use parking_lot::RwLock;
use serde::Serialize;
use tokio::sync::broadcast;

use crate::config::AppConfig;

const FFT_SIZE: usize = 2048;
const BAND_COUNT: usize = 64;

#[derive(Debug, Clone, Serialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AudioFrame {
    #[serde(rename = "type")]
    pub frame_type: &'static str,
    pub seq: u64,
    pub ts: u64,
    pub bins: Vec<f32>,
    pub rms: f32,
    pub peak: f32,
    pub beat: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AudioStatus {
    #[serde(rename = "type")]
    pub status_type: &'static str,
    pub state: &'static str,
    pub selected_device_id: Option<String>,
    pub active_device_id: Option<String>,
    pub reason: Option<String>,
}

impl AudioStatus {
    fn disabled(selected_device_id: Option<String>) -> Self {
        Self {
            status_type: "audio_status",
            state: "disabled",
            selected_device_id,
            active_device_id: None,
            reason: None,
        }
    }
}

#[derive(Clone)]
pub struct AudioHub {
    config: Arc<RwLock<AppConfig>>,
    frame_tx: broadcast::Sender<AudioFrame>,
    status_tx: broadcast::Sender<AudioStatus>,
    status: Arc<RwLock<AudioStatus>>,
}

impl AudioHub {
    pub fn new(config: Arc<RwLock<AppConfig>>) -> Self {
        let (frame_tx, _) = broadcast::channel(16);
        let (status_tx, _) = broadcast::channel(16);
        let status = AudioStatus::disabled(config.read().audio_device_id.clone());
        Self {
            config,
            frame_tx,
            status_tx,
            status: Arc::new(RwLock::new(status)),
        }
    }

    pub fn subscribe_frames(&self) -> broadcast::Receiver<AudioFrame> {
        self.frame_tx.subscribe()
    }
    pub fn subscribe_status(&self) -> broadcast::Receiver<AudioStatus> {
        self.status_tx.subscribe()
    }
    pub fn current_status(&self) -> AudioStatus {
        self.status.read().clone()
    }

    fn publish_status(&self, next: AudioStatus) {
        let mut current = self.status.write();
        if current.state == next.state
            && current.selected_device_id == next.selected_device_id
            && current.active_device_id == next.active_device_id
            && current.reason == next.reason
        {
            return;
        }
        *current = next.clone();
        let _ = self.status_tx.send(next);
    }

    pub fn spawn(self) {
        std::thread::Builder::new()
            .name("vivoflow-audio".into())
            .spawn(move || self.run())
            .expect("spawn audio thread");
    }

    fn run(self) {
        let mut current_selection: Option<String> = None;
        let mut capture: Option<platform::LoopbackCapture> = None;
        let mut processor = SpectrumProcessor::new(48_000);
        let mut seq = 0u64;
        let mut last_frame = Instant::now();
        let mut last_device_probe = Instant::now();
        loop {
            let cfg = self.config.read().clone();
            if !cfg.audio_visualizer_enabled {
                capture = None;
                current_selection = cfg.audio_device_id.clone();
                self.publish_status(AudioStatus::disabled(cfg.audio_device_id));
                std::thread::sleep(Duration::from_millis(250));
                continue;
            }

            if capture.is_none() || current_selection != cfg.audio_device_id {
                current_selection = cfg.audio_device_id.clone();
                match platform::LoopbackCapture::open(cfg.audio_device_id.as_deref()) {
                    Ok(opened) => {
                        let fallback = cfg
                            .audio_device_id
                            .as_deref()
                            .is_some_and(|wanted| wanted != opened.device_id());
                        processor = SpectrumProcessor::new(opened.sample_rate());
                        self.publish_status(AudioStatus {
                            status_type: "audio_status",
                            state: if fallback { "fallback" } else { "capturing" },
                            selected_device_id: cfg.audio_device_id.clone(),
                            active_device_id: Some(opened.device_id().to_owned()),
                            reason: fallback.then(|| "device_unavailable".into()),
                        });
                        capture = Some(opened);
                    }
                    Err(error) => {
                        self.publish_status(AudioStatus {
                            status_type: "audio_status",
                            state: "error",
                            selected_device_id: cfg.audio_device_id.clone(),
                            active_device_id: None,
                            reason: Some(error.to_string()),
                        });
                        std::thread::sleep(Duration::from_secs(2));
                        continue;
                    }
                }
            }

            if last_device_probe.elapsed() >= Duration::from_secs(2) {
                last_device_probe = Instant::now();
                if let (Some(wanted), Some(opened)) =
                    (cfg.audio_device_id.as_deref(), capture.as_ref())
                {
                    if wanted != opened.device_id()
                        && enumerate_devices()
                            .map(|items| items.iter().any(|item| item.id == wanted))
                            .unwrap_or(false)
                    {
                        capture = None;
                        continue;
                    }
                }
            }

            let opened = capture.as_mut().expect("capture initialized");
            match opened.read_samples() {
                Ok(samples) if samples.is_empty() => {
                    processor.push_silence((opened.sample_rate() / 200) as usize)
                }
                Ok(samples) => processor.push(&samples),
                Err(error) => {
                    tracing::warn!("audio capture interrupted: {error:#}");
                    capture = None;
                    std::thread::sleep(Duration::from_millis(300));
                    continue;
                }
            }
            if last_frame.elapsed() >= Duration::from_millis(33) {
                seq = seq.wrapping_add(1);
                let (bins, rms, peak, beat) = processor.frame();
                let _ = self.frame_tx.send(AudioFrame {
                    frame_type: "audio_frame",
                    seq,
                    ts: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                    bins,
                    rms,
                    peak,
                    beat,
                });
                last_frame = Instant::now();
            }
            std::thread::sleep(Duration::from_millis(5));
        }
    }
}

pub fn enumerate_devices() -> anyhow::Result<Vec<AudioDevice>> {
    platform::enumerate_devices()
}

struct SpectrumProcessor {
    sample_rate: u32,
    samples: VecDeque<f32>,
    scratch_re: Vec<f32>,
    scratch_im: Vec<f32>,
    energy_history: VecDeque<f32>,
}

impl SpectrumProcessor {
    fn new(sample_rate: u32) -> Self {
        Self {
            sample_rate,
            samples: VecDeque::with_capacity(FFT_SIZE * 2),
            scratch_re: vec![0.0; FFT_SIZE],
            scratch_im: vec![0.0; FFT_SIZE],
            energy_history: VecDeque::with_capacity(30),
        }
    }

    fn push(&mut self, incoming: &[f32]) {
        self.samples.extend(incoming.iter().copied());
        while self.samples.len() > FFT_SIZE * 2 {
            self.samples.pop_front();
        }
    }

    fn push_silence(&mut self, count: usize) {
        self.samples.extend(std::iter::repeat(0.0).take(count));
        while self.samples.len() > FFT_SIZE * 2 {
            self.samples.pop_front();
        }
    }

    fn frame(&mut self) -> (Vec<f32>, f32, f32, bool) {
        let start = self.samples.len().saturating_sub(FFT_SIZE);
        let mut rms_sum = 0.0f32;
        let mut peak = 0.0f32;
        for index in 0..FFT_SIZE {
            let sample = self.samples.get(start + index).copied().unwrap_or(0.0);
            rms_sum += sample * sample;
            peak = peak.max(sample.abs());
            let window =
                0.5 - 0.5 * (std::f32::consts::TAU * index as f32 / (FFT_SIZE - 1) as f32).cos();
            self.scratch_re[index] = sample * window;
            self.scratch_im[index] = 0.0;
        }
        fft_in_place(&mut self.scratch_re, &mut self.scratch_im);
        let nyquist = self.sample_rate as f32 / 2.0;
        let max_hz = 16_000.0f32.min(nyquist);
        let mut bands = Vec::with_capacity(BAND_COUNT);
        for band in 0..BAND_COUNT {
            let t0 = band as f32 / BAND_COUNT as f32;
            let t1 = (band + 1) as f32 / BAND_COUNT as f32;
            let lo = 40.0 * (max_hz / 40.0).powf(t0);
            let hi = 40.0 * (max_hz / 40.0).powf(t1);
            let i0 = ((lo * FFT_SIZE as f32 / self.sample_rate as f32) as usize).max(1);
            let i1 = ((hi * FFT_SIZE as f32 / self.sample_rate as f32) as usize)
                .max(i0 + 1)
                .min(FFT_SIZE / 2);
            let magnitude = (i0..i1)
                .map(|i| self.scratch_re[i].hypot(self.scratch_im[i]))
                .sum::<f32>()
                / (i1 - i0) as f32;
            bands.push(((magnitude / FFT_SIZE as f32 * 10.0).ln_1p() * 1.7).clamp(0.0, 1.0));
        }
        let rms = (rms_sum / FFT_SIZE as f32).sqrt().clamp(0.0, 1.0);
        let bass = bands[..10].iter().sum::<f32>() / 10.0;
        let average = if self.energy_history.is_empty() {
            bass
        } else {
            self.energy_history.iter().sum::<f32>() / self.energy_history.len() as f32
        };
        let beat = bass > 0.12 && bass > average * 1.45;
        self.energy_history.push_back(bass);
        if self.energy_history.len() > 24 {
            self.energy_history.pop_front();
        }
        (bands, rms, peak.clamp(0.0, 1.0), beat)
    }
}

fn fft_in_place(re: &mut [f32], im: &mut [f32]) {
    let n = re.len();
    debug_assert!(n.is_power_of_two() && im.len() == n);
    let mut j = 0usize;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
    }
    let mut len = 2;
    while len <= n {
        let angle = -std::f32::consts::TAU / len as f32;
        let (step_im, step_re) = angle.sin_cos();
        for base in (0..n).step_by(len) {
            let mut wr = 1.0f32;
            let mut wi = 0.0f32;
            for offset in 0..len / 2 {
                let a = base + offset;
                let b = a + len / 2;
                let tr = wr * re[b] - wi * im[b];
                let ti = wr * im[b] + wi * re[b];
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
                let next_wr = wr * step_re - wi * step_im;
                wi = wr * step_im + wi * step_re;
                wr = next_wr;
            }
        }
        len <<= 1;
    }
}

#[cfg(windows)]
mod platform {
    use super::AudioDevice;
    use anyhow::{Context, Result};
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
    use windows::Win32::Media::Audio::*;
    use windows::Win32::Media::Multimedia::WAVE_FORMAT_IEEE_FLOAT;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED,
        STGM_READ,
    };

    fn init_com() -> Result<()> {
        unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }
            .ok()
            .or_else(|error| {
                if error.code().0 == 0x80010106u32 as i32 {
                    Ok(())
                } else {
                    Err(error)
                }
            })
            .context("initialize COM")
    }
    fn enumerator() -> Result<IMMDeviceEnumerator> {
        init_com()?;
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }
            .context("create audio device enumerator")
    }

    unsafe fn device_id(device: &IMMDevice) -> Result<String> {
        let raw = device.GetId()?;
        let id = raw.to_string()?;
        CoTaskMemFree(Some(raw.0.cast()));
        Ok(id)
    }
    unsafe fn device_name(device: &IMMDevice) -> String {
        device
            .OpenPropertyStore(STGM_READ)
            .and_then(|store| store.GetValue(&PKEY_Device_FriendlyName))
            .map(|value| value.to_string())
            .unwrap_or_else(|_| "Windows audio device".into())
    }

    pub fn enumerate_devices() -> Result<Vec<AudioDevice>> {
        unsafe {
            let e = enumerator()?;
            let default_id = e
                .GetDefaultAudioEndpoint(eRender, eMultimedia)
                .ok()
                .and_then(|d| device_id(&d).ok());
            let collection = e.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
            let mut devices = Vec::new();
            for index in 0..collection.GetCount()? {
                let device = collection.Item(index)?;
                let id = device_id(&device)?;
                devices.push(AudioDevice {
                    is_default: default_id.as_deref() == Some(&id),
                    name: device_name(&device),
                    id,
                });
            }
            devices.sort_by(|a, b| {
                b.is_default
                    .cmp(&a.is_default)
                    .then_with(|| a.name.cmp(&b.name))
            });
            Ok(devices)
        }
    }

    pub struct LoopbackCapture {
        client: IAudioClient,
        capture: IAudioCaptureClient,
        device_id: String,
        sample_rate: u32,
        channels: usize,
        bits: u16,
        float: bool,
    }

    impl LoopbackCapture {
        pub fn open(selected: Option<&str>) -> Result<Self> {
            unsafe {
                let e = enumerator()?;
                let (device, fallback) = if let Some(id) = selected {
                    let wide = HSTRING::from(id);
                    match e.GetDevice(PCWSTR(wide.as_ptr())) {
                        Ok(device) if device.GetState().ok() == Some(DEVICE_STATE_ACTIVE) => {
                            (device, false)
                        }
                        _ => (e.GetDefaultAudioEndpoint(eRender, eMultimedia)?, true),
                    }
                } else {
                    (e.GetDefaultAudioEndpoint(eRender, eMultimedia)?, false)
                };
                let device_id = device_id(&device)?;
                let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;
                let format = client.GetMixFormat()?;
                let wf: &WAVEFORMATEX = &*format;
                let tag = wf.wFormatTag;
                let bits = wf.wBitsPerSample;
                let sample_rate = wf.nSamplesPerSec;
                let channels = wf.nChannels as usize;
                let float = tag == WAVE_FORMAT_IEEE_FLOAT as u16
                    || (tag != WAVE_FORMAT_PCM as u16 && bits == 32);
                client.Initialize(
                    AUDCLNT_SHAREMODE_SHARED,
                    AUDCLNT_STREAMFLAGS_LOOPBACK,
                    0,
                    0,
                    format,
                    None,
                )?;
                let capture = client.GetService::<IAudioCaptureClient>()?;
                client.Start()?;
                CoTaskMemFree(Some(format.cast()));
                let _ = fallback;
                Ok(Self {
                    client,
                    capture,
                    device_id,
                    sample_rate,
                    channels,
                    bits,
                    float,
                })
            }
        }
        pub fn device_id(&self) -> &str {
            &self.device_id
        }
        pub fn sample_rate(&self) -> u32 {
            self.sample_rate
        }
        pub fn read_samples(&mut self) -> Result<Vec<f32>> {
            let mut mono = Vec::new();
            unsafe {
                loop {
                    if self.capture.GetNextPacketSize()? == 0 {
                        break;
                    }
                    let mut data = std::ptr::null_mut();
                    let mut frames = 0u32;
                    let mut flags = 0u32;
                    self.capture
                        .GetBuffer(&mut data, &mut frames, &mut flags, None, None)?;
                    if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 {
                        mono.resize(mono.len() + frames as usize, 0.0);
                    } else if self.float && self.bits == 32 {
                        let values = std::slice::from_raw_parts(
                            data.cast::<f32>(),
                            frames as usize * self.channels,
                        );
                        for frame in values.chunks_exact(self.channels) {
                            mono.push(frame.iter().sum::<f32>() / self.channels as f32);
                        }
                    } else if self.bits == 16 {
                        let values = std::slice::from_raw_parts(
                            data.cast::<i16>(),
                            frames as usize * self.channels,
                        );
                        for frame in values.chunks_exact(self.channels) {
                            mono.push(
                                frame
                                    .iter()
                                    .map(|v| *v as f32 / i16::MAX as f32)
                                    .sum::<f32>()
                                    / self.channels as f32,
                            );
                        }
                    }
                    self.capture.ReleaseBuffer(frames)?;
                }
            }
            Ok(mono)
        }
    }
    impl Drop for LoopbackCapture {
        fn drop(&mut self) {
            unsafe {
                let _ = self.client.Stop();
            }
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use super::AudioDevice;
    pub struct LoopbackCapture;
    impl LoopbackCapture {
        pub fn open(_: Option<&str>) -> anyhow::Result<Self> {
            anyhow::bail!("audio loopback is only supported on Windows")
        }
        pub fn device_id(&self) -> &str {
            ""
        }
        pub fn sample_rate(&self) -> u32 {
            48_000
        }
        pub fn read_samples(&mut self) -> anyhow::Result<Vec<f32>> {
            Ok(Vec::new())
        }
    }
    pub fn enumerate_devices() -> anyhow::Result<Vec<AudioDevice>> {
        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn silence_stays_silent() {
        let mut processor = SpectrumProcessor::new(48_000);
        processor.push(&vec![0.0; FFT_SIZE]);
        let (bins, rms, peak, beat) = processor.frame();
        assert!(bins.iter().all(|v| *v == 0.0));
        assert_eq!(rms, 0.0);
        assert_eq!(peak, 0.0);
        assert!(!beat);
    }
    #[test]
    fn sine_wave_peaks_near_its_log_band() {
        let mut processor = SpectrumProcessor::new(48_000);
        let samples = (0..FFT_SIZE)
            .map(|i| (std::f32::consts::TAU * 1000.0 * i as f32 / 48_000.0).sin() * 0.8)
            .collect::<Vec<_>>();
        processor.push(&samples);
        let (bins, _, _, _) = processor.frame();
        let peak = bins
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .unwrap()
            .0;
        let expected =
            ((1000.0f32 / 40.0).ln() / (16_000.0f32 / 40.0).ln() * BAND_COUNT as f32) as usize;
        assert!(
            peak.abs_diff(expected) <= 2,
            "peak {peak}, expected {expected}"
        );
    }
}
