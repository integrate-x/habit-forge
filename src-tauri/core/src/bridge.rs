use serde_json::{json, Value};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tiny_http::{Header, Method, Response, Server, StatusCode};

pub fn pairing_token(path: &Path) -> Result<String, String> {
    if path.exists() {
        let token = fs::read_to_string(path).map_err(|_| "Could not read pairing token.")?;
        if token.len() == 64 && token.bytes().all(|b| b.is_ascii_hexdigit()) { return Ok(token); }
        return Err("Invalid pairing token file.".into());
    }
    let token = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(|_| "Could not create pairing token.")?;
    file.write_all(token.as_bytes()).map_err(|_| "Could not save pairing token.")?;
    Ok(token)
}

pub fn sanitize_snapshot(value: &Value) -> Result<Value, String> {
    fn select(value: &Value, keys: &[&str]) -> Result<Value, String> {
        let mut map = serde_json::Map::new();
        for key in keys {
            map.insert((*key).to_owned(), value.get(*key).ok_or("Incomplete desktop snapshot.")?.clone());
        }
        Ok(Value::Object(map))
    }
    if value.get("version").and_then(Value::as_u64) != Some(1) { return Err("Unsupported snapshot version.".into()); }
    let habits = value["habits"].as_array().ok_or("Invalid habits.")?.iter().map(|habit| select(habit, &[
        "id", "name", "website", "scheduledTime", "activeDays", "mandatory", "paused", "verificationMethod",
        "completedToday", "currentStreak", "longestStreak",
    ])).collect::<Result<Vec<_>, _>>()?;
    let events = value["completions"].as_array().ok_or("Invalid completions.")?.iter().map(|event| select(event, &[
        "habitId", "completedAt", "localDate", "source",
    ])).collect::<Result<Vec<_>, _>>()?;
    let mut settings = select(&value["settings"], &["version", "blockedSites", "blockingEnabled", "autoOpen", "notifications", "examMode", "graceDays"])?;
    settings["graceDays"] = Value::Array(value["settings"]["graceDays"].as_array().ok_or("Invalid grace days.")?.iter()
        .map(|day| select(day, &["habitId", "localDate"])).collect::<Result<Vec<_>, _>>()?);
    Ok(json!({ "version": 1, "exportedAt": value["exportedAt"], "today": value["today"],
        "habits": habits, "completions": events, "settings": settings }))
}

#[derive(Default)]
struct Payload { snapshot: Option<Value>, seen: Option<Instant> }
pub struct Bridge {
    token: String,
    port: u16,
    payload: Arc<Mutex<Payload>>,
    stopped: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}
impl Bridge {
    pub fn start(port: u16, token: String) -> Result<Self, String> {
        let server = Server::http(("127.0.0.1", port)).map_err(|_| "Desktop companion port is unavailable.")?;
        let port = server.server_addr().to_ip().ok_or("Invalid companion address.")?.port();
        let payload = Arc::new(Mutex::new(Payload::default()));
        let stopped = Arc::new(AtomicBool::new(false));
        let thread_payload = Arc::clone(&payload);
        let thread_stopped = Arc::clone(&stopped);
        let authorization = format!("Bearer {token}");
        let worker = thread::spawn(move || {
            while !thread_stopped.load(Ordering::Relaxed) {
                let request = match server.recv_timeout(Duration::from_millis(200)) {
                    Ok(Some(request)) => request,
                    Ok(None) => continue,
                    Err(_) => break,
                };
                let header = |name: &str| request.headers().iter().find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name))
                    .map(|h| h.value.as_str()).unwrap_or("");
                let host_valid = [format!("127.0.0.1:{port}"), format!("localhost:{port}")].iter().any(|host| host == header("Host"));
                let auth = header("Authorization").as_bytes();
                let expected = authorization.as_bytes();
                let authorized = auth.len() == expected.len() && auth.iter().zip(expected).fold(0u8, |diff, (a, b)| diff | (a ^ b)) == 0;
                let (status, body) = if !host_valid || !authorized {
                    (403, json!({"error": "Pairing token not accepted."}))
                } else if request.method() != &Method::Get || request.url() != "/snapshot" {
                    (404, json!({"error": "Not found."}))
                } else {
                    match thread_payload.lock() {
                        Ok(mut data) => {
                            if let Some(snapshot) = data.snapshot.clone() {
                                data.seen = Some(Instant::now());
                                (200, snapshot)
                            } else { (503, json!({"error": "Desktop snapshot is not ready."})) }
                        }
                        Err(_) => (503, json!({"error": "Desktop snapshot is unavailable."})),
                    }
                };
                let response = Response::from_string(body.to_string()).with_status_code(StatusCode(status))
                    .with_header(Header::from_bytes("Content-Type", "application/json").unwrap())
                    .with_header(Header::from_bytes("Cache-Control", "no-store").unwrap());
                let _ = request.respond(response);
            }
        });
        Ok(Self { token, port, payload, stopped, worker: Some(worker) })
    }
    pub fn publish(&self, snapshot: &Value) -> Result<bool, String> {
        if snapshot.to_string().len() > 2_000_000 { return Err("Desktop snapshot exceeds the size limit.".into()); }
        let snapshot = sanitize_snapshot(snapshot)?;
        let mut data = self.payload.lock().map_err(|_| "Desktop snapshot is unavailable.")?;
        data.snapshot = Some(snapshot);
        Ok(data.seen.is_some_and(|seen| seen.elapsed() < Duration::from_secs(150)))
    }
    pub fn token(&self) -> &str { &self.token }
    pub fn port(&self) -> u16 { self.port }
}
impl Drop for Bridge {
    fn drop(&mut self) {
        self.stopped.store(true, Ordering::Relaxed);
        if let Some(worker) = self.worker.take() { let _ = worker.join(); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpStream;
    fn snapshot() -> Value {
        json!({ "version":1, "exportedAt":"2026-10-12T10:00:00Z", "today":"2026-10-12", "habits":[], "completions":[],
            "settings":{"version":1,"blockedSites":[],"blockingEnabled":false,"autoOpen":false,"notifications":false,"examMode":false,"graceDays":[]} })
    }
    fn request(bridge: &Bridge, auth: &str, host: &str) -> String {
        let mut stream = TcpStream::connect(("127.0.0.1", bridge.port())).unwrap();
        stream.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
        write!(stream, "GET /snapshot HTTP/1.1\r\nHost: {host}\r\nAuthorization: {auth}\r\nConnection: close\r\n\r\n").unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        response
    }
    #[test]
    fn bridge_requires_auth_and_local_host_and_tracks_connections() {
        let bridge = Bridge::start(0, "a".repeat(64)).unwrap();
        assert!(!bridge.publish(&snapshot()).unwrap());
        let host = format!("127.0.0.1:{}", bridge.port());
        assert!(request(&bridge, "Bearer wrong", &host).contains("403"));
        assert!(request(&bridge, &format!("Bearer {}", bridge.token()), "evil.test").contains("403"));
        let response = request(&bridge, &format!("Bearer {}", bridge.token()), &host);
        assert!(response.contains("200"));
        assert!(response.contains("2026-10-12"));
        assert!(bridge.publish(&snapshot()).unwrap());
    }
    #[test]
    fn snapshots_strip_private_and_future_fields() {
        let mut value = snapshot();
        value["secret"] = json!("private");
        value["settings"]["secret"] = json!("private");
        let sanitized = sanitize_snapshot(&value).unwrap();
        assert!(!sanitized.to_string().contains("private"));
        value["version"] = json!(2);
        assert!(sanitize_snapshot(&value).is_err());
    }
    #[test]
    fn pairing_tokens_persist_and_invalid_files_are_not_overwritten() {
        let path = std::env::temp_dir().join(format!("habit-forge-token-{}", uuid::Uuid::new_v4()));
        let first = pairing_token(&path).unwrap();
        assert_eq!(first.len(), 64);
        assert_eq!(first, pairing_token(&path).unwrap());
        fs::write(&path, "invalid").unwrap();
        assert!(pairing_token(&path).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "invalid");
        fs::remove_file(path).unwrap();
    }
}
