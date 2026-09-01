use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use parking_lot::RwLock;
use serde::Serialize;
use tokio::sync::broadcast;

use crate::config::AppConfig;

const FFT_SIZE: usize = 2048;
const BAND_COUNT: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SampleEncoding {
    Float32,
    PcmInteger,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct AudioSampleFormat {
    encoding: SampleEncoding,
    channels: usize,
    container_bits: u16,
    valid_bits: u16,
    block_align: usize,
}

#[derive(Debug)]
struct DecodedAudio {
    samples: Vec<f32>,
    raw_peak: f32,
    downmix_peak: f32,
    cancellation_protected: bool,
}

impl AudioSampleFormat {
    fn bytes_per_sample(self) -> usize {
        usize::from(self.container_bits / 8)
    }

    fn decode_frames(self, data: &[u8], frames: usize) -> anyhow::Result<DecodedAudio> {
        let expected = frames
            .checked_mul(self.block_align)
            .ok_or_else(|| anyhow::anyhow!("audio packet size overflow"))?;
        if data.len() < expected {
            anyhow::bail!(
                "audio packet is too short: expected {expected} bytes, got {}",
                data.len()
            );
        }

        let bytes_per_sample = self.bytes_per_sample();
        let mut interleaved = Vec::with_capacity(frames * self.channels);
        let mut channel_energy = vec![0.0f64; self.channels];
        let mut averaged = Vec::with_capacity(frames);
        let mut average_energy = 0.0f64;
        let mut raw_peak = 0.0f32;

        for frame in data[..expected].chunks_exact(self.block_align) {
            let mut sum = 0.0f32;
            for (channel, energy) in channel_energy.iter_mut().enumerate() {
                let start = channel * bytes_per_sample;
                let sample = &frame[start..start + bytes_per_sample];
                let value = match self.encoding {
                    SampleEncoding::Float32 => {
                        let value = f32::from_le_bytes(sample.try_into().expect("validated f32"));
                        if value.is_finite() {
                            value.clamp(-1.0, 1.0)
                        } else {
                            0.0
                        }
                    }
                    SampleEncoding::PcmInteger => {
                        decode_pcm_integer(sample, self.container_bits, self.valid_bits)
                    }
                };
                raw_peak = raw_peak.max(value.abs());
                *energy += f64::from(value) * f64::from(value);
                interleaved.push(value);
                sum += value;
            }
            let average = (sum / self.channels as f32).clamp(-1.0, 1.0);
            average_energy += f64::from(average) * f64::from(average);
            averaged.push(average);
        }

        let (strongest_channel, strongest_energy) = channel_energy
            .iter()
            .copied()
            .enumerate()
            .fold((0, 0.0f64), |strongest, candidate| {
                if candidate.1 > strongest.1 {
                    candidate
                } else {
                    strongest
                }
            });
        // Preserve the normal stereo average unless it has lost over 99% of the
        // strongest channel's energy. This catches inverted/special channel layouts
        // without changing ordinary stereo balance or hard-panned material.
        let cancellation_protected = self.channels > 1
            && strongest_energy > f64::EPSILON
            && average_energy < strongest_energy * 0.01;
        let samples = if cancellation_protected {
            interleaved
                .chunks_exact(self.channels)
                .map(|frame| frame[strongest_channel])
                .collect()
        } else {
            averaged
        };
        let downmix_peak = samples
            .iter()
            .fold(0.0f32, |peak, value| peak.max(value.abs()));
        Ok(DecodedAudio {
            samples,
            raw_peak,
            downmix_peak,
            cancellation_protected,
        })
    }
}

fn decode_pcm_integer(sample: &[u8], container_bits: u16, valid_bits: u16) -> f32 {
    let raw = match container_bits {
        16 => i16::from_le_bytes(sample.try_into().expect("validated i16")) as i32,
        24 => {
            let unsigned = sample[0] as i32 | (sample[1] as i32) << 8 | (sample[2] as i32) << 16;
            (unsigned << 8) >> 8
        }
        32 => i32::from_le_bytes(sample.try_into().expect("validated i32")),
        _ => unreachable!("container width is validated when capture opens"),
    };
    // Reduced-valid-bit WAVEFORMATEXTENSIBLE PCM is left-aligned in its container.
    let aligned = raw >> (container_bits - valid_bits);
    let scale = (1u64 << (valid_bits - 1)) as f32;
    (aligned as f32 / scale).clamp(-1.0, 1.0)
}

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
            if !audio_capture_enabled(&cfg) {
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
                        tracing::warn!(
                            selected_device_id = ?cfg.audio_device_id,
                            "failed to open audio loopback capture: {error:#}"
                        );
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

fn audio_capture_enabled(config: &AppConfig) -> bool {
    config.audio_visualizer_enabled || (config.particle_enabled && config.particle_audio_reactive)
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
    use super::{AudioDevice, AudioSampleFormat, DecodedAudio, SampleEncoding};
    use anyhow::{bail, Context, Result};
    use std::time::{Duration, Instant};
    use windows::core::{GUID, HSTRING, PCWSTR};
    use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
    use windows::Win32::Media::Audio::*;
    use windows::Win32::Media::Multimedia::{
        KSDATAFORMAT_SUBTYPE_IEEE_FLOAT, WAVE_FORMAT_IEEE_FLOAT,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED,
        STGM_READ,
    };

    const WAVE_FORMAT_EXTENSIBLE_TAG: u16 = 0xfffe;
    const PCM_SUBFORMAT: GUID = GUID::from_u128(0x00000001_0000_0010_8000_00aa00389b71);

    unsafe fn parse_mix_format(wf: &WAVEFORMATEX) -> Result<AudioSampleFormat> {
        let tag = wf.wFormatTag;
        let sample_rate = wf.nSamplesPerSec;
        let channels_u16 = wf.nChannels;
        let channels = usize::from(channels_u16);
        let container_bits = wf.wBitsPerSample;
        let block_align_u16 = wf.nBlockAlign;
        let block_align = usize::from(block_align_u16);
        let extra_size = wf.cbSize;
        let (encoding, valid_bits, subformat) = match tag {
            value if value == WAVE_FORMAT_PCM as u16 => {
                (SampleEncoding::PcmInteger, container_bits, None)
            }
            value if value == WAVE_FORMAT_IEEE_FLOAT as u16 => {
                (SampleEncoding::Float32, container_bits, None)
            }
            WAVE_FORMAT_EXTENSIBLE_TAG => {
                if usize::from(extra_size)
                    < std::mem::size_of::<WAVEFORMATEXTENSIBLE>()
                        - std::mem::size_of::<WAVEFORMATEX>()
                {
                    bail!("WAVEFORMATEXTENSIBLE data is truncated (cbSize={extra_size})");
                }
                let extensible = std::ptr::read_unaligned(
                    (wf as *const WAVEFORMATEX).cast::<WAVEFORMATEXTENSIBLE>(),
                );
                let valid_bits = extensible.Samples.wValidBitsPerSample;
                let subformat = extensible.SubFormat;
                let encoding = if subformat == PCM_SUBFORMAT {
                    SampleEncoding::PcmInteger
                } else if subformat == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT {
                    SampleEncoding::Float32
                } else {
                    bail!("unsupported WAVEFORMATEXTENSIBLE subformat {subformat:?}");
                };
                (encoding, valid_bits, Some(subformat))
            }
            _ => bail!("unsupported wave format tag 0x{tag:04x}"),
        };

        if channels == 0 {
            bail!("audio format has zero channels");
        }
        if sample_rate == 0 {
            bail!("audio format has zero sample rate");
        }
        match encoding {
            SampleEncoding::Float32 if container_bits != 32 || valid_bits != 32 => bail!(
                "unsupported float format: container_bits={container_bits}, valid_bits={valid_bits}"
            ),
            SampleEncoding::PcmInteger
                if !matches!(container_bits, 16 | 24 | 32)
                    || valid_bits == 0
                    || valid_bits > container_bits =>
            {
                bail!(
                    "unsupported PCM format: container_bits={container_bits}, valid_bits={valid_bits}"
                )
            }
            _ => {}
        }
        let bytes_per_sample = usize::from(container_bits / 8);
        let minimum_align = channels
            .checked_mul(bytes_per_sample)
            .context("audio block alignment overflow")?;
        if container_bits % 8 != 0 || block_align < minimum_align {
            bail!(
                "invalid audio block alignment: channels={channels}, container_bits={container_bits}, block_align={block_align}"
            );
        }
        tracing::debug!(
            tag = format_args!("0x{tag:04x}"),
            ?subformat,
            sample_rate,
            channels,
            container_bits,
            valid_bits,
            block_align,
            "parsed WASAPI mix format"
        );
        Ok(AudioSampleFormat {
            encoding,
            channels,
            container_bits,
            valid_bits,
            block_align,
        })
    }

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
        format: AudioSampleFormat,
        diagnostics: CaptureDiagnostics,
    }

    struct CaptureDiagnostics {
        started: Instant,
        polls: u64,
        packets: u64,
        silent_packets: u64,
        non_silent_packets: u64,
        frames: u64,
        cancellation_protections: u64,
        raw_peak: f32,
        downmix_peak: f32,
    }

    impl CaptureDiagnostics {
        fn new() -> Self {
            Self {
                started: Instant::now(),
                polls: 0,
                packets: 0,
                silent_packets: 0,
                non_silent_packets: 0,
                frames: 0,
                cancellation_protections: 0,
                raw_peak: 0.0,
                downmix_peak: 0.0,
            }
        }

        fn record(&mut self, frames: usize, silent: bool, decoded: &DecodedAudio) {
            self.packets += 1;
            self.frames += frames as u64;
            if silent {
                self.silent_packets += 1;
            } else {
                self.non_silent_packets += 1;
            }
            if decoded.cancellation_protected {
                self.cancellation_protections += 1;
            }
            self.raw_peak = self.raw_peak.max(decoded.raw_peak);
            self.downmix_peak = self.downmix_peak.max(decoded.downmix_peak);
        }

        fn log_if_due(&mut self, device_id: &str) {
            if self.started.elapsed() < Duration::from_secs(5) {
                return;
            }
            tracing::info!(
                device_id,
                polls = self.polls,
                packets = self.packets,
                silent_packets = self.silent_packets,
                non_silent_packets = self.non_silent_packets,
                frames = self.frames,
                raw_peak = self.raw_peak,
                downmix_peak = self.downmix_peak,
                cancellation_protections = self.cancellation_protections,
                "audio loopback capture diagnostics"
            );
            *self = Self::new();
        }
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
                let device_name = device_name(&device);
                let client: IAudioClient =
                    device.Activate(CLSCTX_ALL, None).with_context(|| {
                        format!("activate audio device '{device_name}' ({device_id})")
                    })?;
                let format = client
                    .GetMixFormat()
                    .with_context(|| format!("get mix format for '{device_name}' ({device_id})"))?;
                let wf: &WAVEFORMATEX = &*format;
                let tag = wf.wFormatTag;
                let sample_rate = wf.nSamplesPerSec;
                let channels = wf.nChannels;
                let bits = wf.wBitsPerSample;
                let align = wf.nBlockAlign;
                let extra_size = wf.cbSize;
                let setup_result = (|| -> Result<(AudioSampleFormat, IAudioCaptureClient)> {
                    let sample_format = parse_mix_format(wf).with_context(|| {
                        format!(
                            "unsupported audio mix format for '{device_name}' ({device_id}): tag=0x{tag:04x}, rate={sample_rate}, channels={channels}, bits={bits}, align={align}, cbSize={extra_size}"
                        )
                    })?;
                    client
                        .Initialize(
                            AUDCLNT_SHAREMODE_SHARED,
                            AUDCLNT_STREAMFLAGS_LOOPBACK,
                            0,
                            0,
                            format,
                            None,
                        )
                        .with_context(|| {
                            format!("initialize shared loopback for '{device_name}' ({device_id})")
                        })?;
                    let capture =
                        client
                            .GetService::<IAudioCaptureClient>()
                            .with_context(|| {
                                format!("get capture service for '{device_name}' ({device_id})")
                            })?;
                    client.Start().with_context(|| {
                        format!("start loopback for '{device_name}' ({device_id})")
                    })?;
                    Ok((sample_format, capture))
                })();
                CoTaskMemFree(Some(format.cast()));
                let (sample_format, capture) = setup_result?;
                tracing::info!(
                    device_name,
                    device_id,
                    fallback,
                    sample_rate,
                    channels = sample_format.channels,
                    container_bits = sample_format.container_bits,
                    valid_bits = sample_format.valid_bits,
                    encoding = ?sample_format.encoding,
                    "audio loopback capture started"
                );
                Ok(Self {
                    client,
                    capture,
                    device_id,
                    sample_rate,
                    format: sample_format,
                    diagnostics: CaptureDiagnostics::new(),
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
            self.diagnostics.polls += 1;
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
                    let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0;
                    let decoded = if silent {
                        Ok(DecodedAudio {
                            samples: vec![0.0; frames as usize],
                            raw_peak: 0.0,
                            downmix_peak: 0.0,
                            cancellation_protected: false,
                        })
                    } else {
                        let Some(byte_len) = (frames as usize).checked_mul(self.format.block_align)
                        else {
                            self.capture.ReleaseBuffer(frames)?;
                            bail!("audio packet size overflow");
                        };
                        let bytes = std::slice::from_raw_parts(data.cast::<u8>(), byte_len);
                        self.format.decode_frames(bytes, frames as usize)
                    };
                    // Every successful GetBuffer must be paired with ReleaseBuffer, including
                    // packets whose contents fail validation.
                    let release_result = self.capture.ReleaseBuffer(frames);
                    let decoded = decoded?;
                    release_result?;
                    self.diagnostics.record(frames as usize, silent, &decoded);
                    mono.extend(decoded.samples);
                }
            }
            self.diagnostics.log_if_due(&self.device_id);
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
    fn particle_audio_response_controls_capture_without_audio_visualizer() {
        let mut config = AppConfig::default();
        assert!(!audio_capture_enabled(&config));
        config.particle_enabled = true;
        config.particle_audio_reactive = true;
        assert!(audio_capture_enabled(&config));
        config.particle_enabled = false;
        assert!(!audio_capture_enabled(&config));
        config.audio_visualizer_enabled = true;
        assert!(audio_capture_enabled(&config));
    }

    fn pcm_format(container_bits: u16, valid_bits: u16, channels: usize) -> AudioSampleFormat {
        AudioSampleFormat {
            encoding: SampleEncoding::PcmInteger,
            channels,
            container_bits,
            valid_bits,
            block_align: channels * usize::from(container_bits / 8),
        }
    }

    fn float_format(channels: usize) -> AudioSampleFormat {
        AudioSampleFormat {
            encoding: SampleEncoding::Float32,
            channels,
            container_bits: 32,
            valid_bits: 32,
            block_align: channels * 4,
        }
    }

    fn float_bytes(samples: &[f32]) -> Vec<u8> {
        samples
            .iter()
            .flat_map(|sample| sample.to_le_bytes())
            .collect()
    }

    fn assert_near(actual: f32, expected: f32) {
        assert!(
            (actual - expected).abs() < 0.0001,
            "actual={actual}, expected={expected}"
        );
    }

    #[test]
    fn decodes_float_and_sanitizes_non_finite_values() {
        let format = float_format(1);
        let data = float_bytes(&[0.5, -2.0, f32::NAN]);
        let decoded = format.decode_frames(&data, 3).unwrap();
        assert_eq!(decoded.samples, vec![0.5, -1.0, 0.0]);
        assert_near(decoded.raw_peak, 1.0);
        assert_near(decoded.downmix_peak, 1.0);
        assert!(!decoded.cancellation_protected);
    }

    #[test]
    fn decodes_signed_pcm_container_widths() {
        assert_near(
            pcm_format(16, 16, 1)
                .decode_frames(&16384i16.to_le_bytes(), 1)
                .unwrap()
                .samples[0],
            0.5,
        );
        assert_near(
            pcm_format(24, 24, 1)
                .decode_frames(&[0x00, 0x00, 0xc0], 1)
                .unwrap()
                .samples[0],
            -0.5,
        );
        assert_near(
            pcm_format(32, 32, 1)
                .decode_frames(&1073741824i32.to_le_bytes(), 1)
                .unwrap()
                .samples[0],
            0.5,
        );
    }

    #[test]
    fn decodes_left_aligned_valid_bits_and_mixes_channels() {
        let left = (4194304i32 << 8).to_le_bytes();
        let right = (-4194304i32 << 8).to_le_bytes();
        let data = [left, right].concat();
        let decoded = pcm_format(32, 24, 2).decode_frames(&data, 1).unwrap();
        assert_near(decoded.samples[0], 0.5);
        assert!(decoded.cancellation_protected);
    }

    #[test]
    fn averages_in_phase_and_normal_stereo_channels() {
        let in_phase = float_format(2)
            .decode_frames(&float_bytes(&[0.4, 0.4, -0.2, -0.2]), 2)
            .unwrap();
        assert_eq!(in_phase.samples, vec![0.4, -0.2]);
        assert!(!in_phase.cancellation_protected);

        let stereo = float_format(2)
            .decode_frames(&float_bytes(&[0.8, 0.2, 0.4, -0.2]), 2)
            .unwrap();
        assert_near(stereo.samples[0], 0.5);
        assert_near(stereo.samples[1], 0.1);
        assert!(!stereo.cancellation_protected);
    }

    #[test]
    fn protects_against_inverted_float_channels() {
        let decoded = float_format(2)
            .decode_frames(&float_bytes(&[0.75, -0.75, -0.5, 0.5]), 2)
            .unwrap();
        assert_eq!(decoded.samples, vec![0.75, -0.5]);
        assert!(decoded.cancellation_protected);
        assert_near(decoded.raw_peak, 0.75);
        assert_near(decoded.downmix_peak, 0.75);
    }

    #[test]
    fn clamps_pcm_boundaries_and_rejects_short_packets() {
        let format = pcm_format(16, 16, 1);
        assert_eq!(
            format
                .decode_frames(&i16::MIN.to_le_bytes(), 1)
                .unwrap()
                .samples[0],
            -1.0
        );
        assert!(format.decode_frames(&[0], 1).is_err());
    }

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
