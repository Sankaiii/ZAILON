use tauri::WebviewWindow;
use std::path::Path;
use std::fs;
use serde::{Deserialize, Serialize};

// ─── Window controls ──────────────────────────────────────────────────────────
#[tauri::command]
fn close_window(window: WebviewWindow) { let _ = window.close(); }

#[tauri::command]
fn minimize_window(window: WebviewWindow) { let _ = window.minimize(); }

#[tauri::command]
fn toggle_maximize(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) { let _ = window.unmaximize(); }
    else { let _ = window.maximize(); }
}

// ─── Folder / file picker ─────────────────────────────────────────────────────
#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .pick_folder()
        .await
        .map(|p| p.to_string())
}

#[tauri::command]
async fn pick_file(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .add_filter("Executable", &["exe"])
        .pick_file()
        .await
        .map(|p| p.to_string())
}

// ─── Launch game ──────────────────────────────────────────────────────────────
#[tauri::command]
fn launch_game(exec_path: String) -> Result<(), String> {
    std::process::Command::new(&exec_path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to launch: {}", e))
}

// ─── Mod scanning ─────────────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Clone)]
pub struct ModInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub enabled: bool,
    pub mod_type: String,
    pub size_mb: f64,
}

#[tauri::command]
fn scan_mods(mods_path: String) -> Result<Vec<ModInfo>, String> {
    let path = Path::new(&mods_path);
    if !path.exists() { return Ok(vec![]); }

    let mut mods = vec![];
    for entry in fs::read_dir(path).map_err(|e| e.to_string())?.flatten() {
        let raw = entry.file_name().to_string_lossy().to_string();
        let ep = entry.path();
        let ps = ep.to_string_lossy().to_string();

        let mod_type = if ep.is_dir() {
            if raw.starts_with('.') { continue; }
            "folder"
        } else if raw.ends_with(".pak") { "pak" }
        else if raw.ends_with(".asi") { "asi" }
        else if raw.ends_with(".dll") { "dll" }
        else { continue };

        let enabled = !raw.starts_with("DISABLED_");
        let clean = raw
            .trim_start_matches("DISABLED_")
            .trim_end_matches(".pak")
            .trim_end_matches(".asi")
            .trim_end_matches(".dll")
            .to_string();

        let size_mb = if ep.is_dir() {
            dir_size(&ep) as f64 / 1_048_576.0
        } else {
            entry.metadata().map(|m| m.len()).unwrap_or(0) as f64 / 1_048_576.0
        };

        mods.push(ModInfo {
            id: ps.clone(),
            name: clean,
            path: ps,
            enabled,
            mod_type: mod_type.to_string(),
            size_mb: (size_mb * 10.0).round() / 10.0,
        });
    }

    mods.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(mods)
}

fn dir_size(p: &Path) -> u64 {
    fs::read_dir(p).map(|entries| {
        entries.flatten().map(|e| {
            let ep = e.path();
            if ep.is_file() { e.metadata().map(|m| m.len()).unwrap_or(0) }
            else { dir_size(&ep) }
        }).sum()
    }).unwrap_or(0)
}

// ─── Toggle mod ───────────────────────────────────────────────────────────────
#[tauri::command]
fn toggle_mod(mod_path: String, enable: bool) -> Result<String, String> {
    let path = Path::new(&mod_path);
    let parent = path.parent().ok_or("No parent directory")?;
    let raw = path.file_name()
        .ok_or("No filename")?
        .to_string_lossy()
        .to_string();

    let new_name = if enable {
        raw.trim_start_matches("DISABLED_").to_string()
    } else {
        if raw.starts_with("DISABLED_") { return Ok(mod_path); }
        format!("DISABLED_{}", raw)
    };

    let new_path = parent.join(&new_name);
    fs::rename(&mod_path, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_mod(mod_path: String) -> Result<(), String> {
    let p = Path::new(&mod_path);
    if p.is_dir() { fs::remove_dir_all(p) } else { fs::remove_file(p) }
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn path_exists(p: String) -> bool {
    Path::new(&p).exists()
}

#[tauri::command]
fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &data).map_err(|e| e.to_string())
}

// ─── Extract zip (bytes passed from JS) ──────────────────────────────────────
#[tauri::command]
fn extract_zip_bytes(data: Vec<u8>, dest_path: String) -> Result<(), String> {
    use std::io::Cursor;
    let cursor = Cursor::new(data);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;
    let dest = Path::new(&dest_path);
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let out = match file.enclosed_name() {
            Some(name) => dest.join(name),
            None => continue,
        };
        if file.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = out.parent() {
                fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            let mut outfile = fs::File::create(&out).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ─── Auto-detect games ────────────────────────────────────────────────────────
#[derive(Serialize)]
pub struct DetectedGame {
    pub name: String,
    pub path: String,
    pub exec_path: String,
    pub game_id: u64,
}

#[tauri::command]
fn detect_games() -> Vec<DetectedGame> {
    let mut found = vec![];
    let drives = ["C:", "D:", "E:", "F:", "G:", "H:"];
    let common = ["\\Program Files", "\\Program Files (x86)", "\\Games",
                  "\\logiciel jeux", "\\SteamLibrary\\steamapps\\common",
                  "\\Steam\\steamapps\\common"];
    let sigs: &[(&str, &str, u64, &[&str])] = &[
        ("Neverness to Everness", "NTE.exe", 20920, &[
            "\\Neverness to Everness\\HTGame\\Binaries\\Win64\\NTE.exe",
            "\\Neverness to Everness\\NTE.exe",
        ]),
        ("Genshin Impact", "GenshinImpact.exe", 7545, &[
            "\\Genshin Impact\\GenshinImpact.exe",
            "\\Genshin Impact game\\GenshinImpact.exe",
        ]),
        ("Honkai: Star Rail", "StarRail.exe", 18874, &[
            "\\Honkai Star Rail\\Game\\StarRail.exe",
        ]),
        ("Zenless Zone Zero", "ZenlessZoneZero.exe", 20292, &[
            "\\ZenlessZoneZero Game\\ZenlessZoneZero.exe",
        ]),
        ("Wuthering Waves", "Wuthering Waves.exe", 20545, &[
            "\\Wuthering Waves Game\\Wuthering Waves.exe",
            "\\Wuthering Waves\\Wuthering Waves.exe",
        ]),
        ("Cyberpunk 2077", "Cyberpunk2077.exe", 7371, &[
            "\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe",
        ]),
    ];

    for drive in &drives {
        for dir in &common {
            for (name, _exe, gb_id, paths) in sigs {
                for rel in *paths {
                    let full = format!("{}{}{}", drive, dir, rel);
                    if Path::new(&full).exists() {
                        let game_dir = Path::new(&full)
                            .parent()
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default();
                        found.push(DetectedGame {
                            name: name.to_string(),
                            path: game_dir,
                            exec_path: full,
                            game_id: *gb_id,
                        });
                        break;
                    }
                }
            }
        }
    }

    found.dedup_by_key(|g| g.exec_path.clone());
    found
}

// ─── Open URL in browser ──────────────────────────────────────────────────────
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { std::process::Command::new("cmd").args(["/c", "start", &url]).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")]
    { std::process::Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "linux")]
    { std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

// ─── App entry ────────────────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            close_window, minimize_window, toggle_maximize,
            pick_folder, pick_file,
            launch_game,
            scan_mods, toggle_mod, delete_mod, ensure_dir, path_exists,
            write_file, extract_zip_bytes,
            detect_games,
            open_url,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| eprintln!("ZAILON error: {}", e));
}
