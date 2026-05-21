use tauri::{WebviewWindow, Manager};

#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn close_window(window: WebviewWindow) {
    window.close().unwrap_or(());
}

#[tauri::command]
fn minimize_window(window: WebviewWindow) {
    window.minimize().unwrap_or(());
}

#[tauri::command]
fn toggle_maximize(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().unwrap_or(());
    } else {
        window.maximize().unwrap_or(());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_version,
            close_window,
            minimize_window,
            toggle_maximize
        ])
        .setup(|app| {
            let window = app.get_webview_window("main")
                .expect("main window not found");
            // Show window after setup to prevent white flash
            window.show().unwrap_or(());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ZAILON");
}
