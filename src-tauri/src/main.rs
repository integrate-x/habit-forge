#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use habit_forge_core::{bridge::{Bridge, pairing_token}, verification::{VerifyRequest, VerifyResult}};
use serde_json::{json, Value};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

struct DesktopState { bridge: Result<Bridge, String> }

#[tauri::command]
fn publish_desktop_snapshot(snapshot: Value, state: tauri::State<DesktopState>) -> Result<Value, String> {
    let bridge = state.bridge.as_ref().map_err(Clone::clone)?;
    Ok(json!({"connected": bridge.publish(&snapshot)?}))
}
#[tauri::command]
fn desktop_pairing_info(state: tauri::State<DesktopState>) -> Result<Value, String> {
    let bridge = state.bridge.as_ref().map_err(Clone::clone)?;
    Ok(json!({"token":bridge.token(), "port":bridge.port()}))
}
#[tauri::command]
async fn verify_native(request: VerifyRequest) -> Result<VerifyResult, String> {
    tokio::time::timeout(std::time::Duration::from_secs(20), habit_forge_core::verification::verify(request))
        .await.map_err(|_| "Verification timed out. Retry later.".to_string())?
}
#[tauri::command]
async fn save_backup(app: tauri::AppHandle, data: String) -> Result<bool, String> {
    if data.len() > 5_000_000 { return Err("Backup exceeds the size limit.".into()); }
    let value: Value = serde_json::from_str(&data).map_err(|_| "Invalid backup JSON.")?;
    if value["version"] != 1 { return Err("Unsupported backup.".into()); }
    let (send, receive) = tokio::sync::oneshot::channel();
    app.dialog().file().add_filter("JSON backup", &["json"]).set_file_name("habit-forge-backup.json")
        .save_file(move |path| { let _ = send.send(path); });
    let path = receive.await.map_err(|_| "Save dialog failed.")?;
    if let Some(path) = path {
        let path = path.into_path().map_err(|_| "Invalid backup path.")?;
        std::fs::write(path, data).map_err(|_| "Could not save backup.")?;
        Ok(true)
    } else { Ok(false) }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") { let _ = window.set_focus(); }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let bridge = (|| {
                let directory = app.path().app_data_dir().map_err(|_| "Desktop data directory is unavailable.".to_string())?;
                std::fs::create_dir_all(&directory).map_err(|_| "Could not create desktop data directory.")?;
                Bridge::start(5175, pairing_token(&directory.join("companion-token"))?)
            })();
            app.manage(DesktopState { bridge });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![publish_desktop_snapshot, desktop_pairing_info, verify_native, save_backup])
        .run(tauri::generate_context!())
        .expect("failed to run Habit Forge");
}
