use std::collections::BTreeSet;
use std::fs;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use rcgen::{
    BasicConstraints, CertificateParams, DistinguishedName, DnType, ExtendedKeyUsagePurpose, IsCa,
    Issuer, KeyPair, KeyUsagePurpose,
};

const ROOT_CA_CERT_FILE: &str = "vivoflow-root-ca.pem";
const ROOT_CA_KEY_FILE: &str = "vivoflow-root-ca-key.pem";
const SERVER_CERT_FILE: &str = "vivoflow-server.pem";
const SERVER_KEY_FILE: &str = "vivoflow-server-key.pem";

#[derive(Clone, Debug)]
pub struct TlsAssets {
    pub root_ca_cert_path: PathBuf,
    pub server_cert_path: PathBuf,
    pub server_key_path: PathBuf,
    pub subject_alt_names: Vec<String>,
}

pub fn ensure_tls_assets() -> Result<TlsAssets> {
    let config_path = crate::config::config_file_path();
    let base = config_path.parent().unwrap_or_else(|| Path::new("."));
    ensure_tls_assets_in(&base.join("tls"))
}

fn ensure_tls_assets_in(dir: &Path) -> Result<TlsAssets> {
    fs::create_dir_all(dir)
        .with_context(|| format!("failed to create TLS directory {}", dir.display()))?;

    let root_ca_cert_path = dir.join(ROOT_CA_CERT_FILE);
    let root_ca_key_path = dir.join(ROOT_CA_KEY_FILE);
    let server_cert_path = dir.join(SERVER_CERT_FILE);
    let server_key_path = dir.join(SERVER_KEY_FILE);

    ensure_root_ca(&root_ca_cert_path, &root_ca_key_path)?;

    let root_pem = fs::read_to_string(&root_ca_cert_path)
        .with_context(|| format!("failed to read {}", root_ca_cert_path.display()))?;
    let root_key_pem = fs::read_to_string(&root_ca_key_path)
        .with_context(|| format!("failed to read {}", root_ca_key_path.display()))?;
    let root_key = KeyPair::from_pem(&root_key_pem).context("invalid VivoFlow root CA key")?;
    let issuer = Issuer::from_ca_cert_pem(&root_pem, root_key)
        .context("invalid VivoFlow root CA certificate")?;

    let subject_alt_names = local_subject_alt_names();
    let mut params = CertificateParams::new(subject_alt_names.clone())
        .context("invalid server certificate subject alternative name")?;
    let mut distinguished_name = DistinguishedName::new();
    distinguished_name.push(DnType::OrganizationName, "VivoFlow");
    distinguished_name.push(DnType::CommonName, "VivoFlow local server");
    params.distinguished_name = distinguished_name;
    params.use_authority_key_identifier_extension = true;
    params.key_usages = vec![KeyUsagePurpose::DigitalSignature];
    params.extended_key_usages = vec![ExtendedKeyUsagePurpose::ServerAuth];

    let server_key = KeyPair::generate().context("failed to generate HTTPS server key")?;
    let server_cert = params
        .signed_by(&server_key, &issuer)
        .context("failed to sign HTTPS server certificate")?;
    write_private(&server_key_path, server_key.serialize_pem().as_bytes())?;
    write_file(&server_cert_path, server_cert.pem().as_bytes())?;

    Ok(TlsAssets {
        root_ca_cert_path,
        server_cert_path,
        server_key_path,
        subject_alt_names,
    })
}

fn ensure_root_ca(cert_path: &Path, key_path: &Path) -> Result<()> {
    match (cert_path.exists(), key_path.exists()) {
        (true, true) => return Ok(()),
        (false, false) => {}
        _ => anyhow::bail!(
            "incomplete TLS root CA at {}; restore both CA files or remove the TLS directory",
            cert_path
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .display()
        ),
    }

    let mut params = CertificateParams::new(Vec::<String>::new())?;
    params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
    let mut distinguished_name = DistinguishedName::new();
    distinguished_name.push(DnType::OrganizationName, "VivoFlow");
    distinguished_name.push(DnType::CommonName, "VivoFlow Local Root CA");
    params.distinguished_name = distinguished_name;
    params.key_usages = vec![
        KeyUsagePurpose::DigitalSignature,
        KeyUsagePurpose::KeyCertSign,
        KeyUsagePurpose::CrlSign,
    ];

    let key = KeyPair::generate().context("failed to generate root CA key")?;
    let cert = params
        .self_signed(&key)
        .context("failed to create root CA certificate")?;
    write_private(key_path, key.serialize_pem().as_bytes())?;
    write_file(cert_path, cert.pem().as_bytes())?;
    Ok(())
}

fn local_subject_alt_names() -> Vec<String> {
    let mut names = BTreeSet::from([
        "localhost".to_string(),
        IpAddr::V4(Ipv4Addr::LOCALHOST).to_string(),
        IpAddr::V6(Ipv6Addr::LOCALHOST).to_string(),
    ]);

    if let Ok(hostname) = hostname::get() {
        let hostname = hostname.to_string_lossy().trim().to_string();
        if !hostname.is_empty() {
            names.insert(hostname.clone());
            if !hostname.contains('.') {
                names.insert(format!("{hostname}.local"));
            }
        }
    }

    if let Ok(interfaces) = local_ip_address::list_afinet_netifas() {
        for (_, ip) in interfaces {
            if !ip.is_unspecified() && !ip.is_multicast() {
                names.insert(ip.to_string());
            }
        }
    }

    names.into_iter().collect()
}

fn write_file(path: &Path, contents: &[u8]) -> Result<()> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, contents)
        .with_context(|| format!("failed to write {}", temporary.display()))?;
    fs::rename(&temporary, path).with_context(|| format!("failed to replace {}", path.display()))
}

fn write_private(path: &Path, contents: &[u8]) -> Result<()> {
    write_file(path, contents)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_a_stable_root_and_fresh_server_certificate() {
        let temporary = tempfile::tempdir().unwrap();
        let first = ensure_tls_assets_in(temporary.path()).unwrap();
        let first_root = fs::read(&first.root_ca_cert_path).unwrap();
        let first_leaf = fs::read(&first.server_cert_path).unwrap();

        let second = ensure_tls_assets_in(temporary.path()).unwrap();
        assert_eq!(first_root, fs::read(second.root_ca_cert_path).unwrap());
        assert_ne!(first_leaf, fs::read(second.server_cert_path).unwrap());
        assert!(second
            .subject_alt_names
            .iter()
            .any(|name| name == "localhost"));
        assert!(second
            .subject_alt_names
            .iter()
            .any(|name| name == "127.0.0.1"));
    }

    #[test]
    fn refuses_an_incomplete_root_ca_pair() {
        let temporary = tempfile::tempdir().unwrap();
        fs::write(temporary.path().join(ROOT_CA_CERT_FILE), "broken").unwrap();
        let error = ensure_tls_assets_in(temporary.path()).unwrap_err();
        assert!(error.to_string().contains("incomplete TLS root CA"));
    }
}
