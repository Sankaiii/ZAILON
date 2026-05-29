use tauri::WebviewWindow;
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};

// ─── Window controls ──────────────────────────────────────────────────────────
#[tauri::command] fn close_window(window: WebviewWindow) { let _ = window.close(); }
#[tauri::command] fn minimize_window(window: WebviewWindow) { let _ = window.minimize(); }
#[tauri::command] fn toggle_maximize(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) { let _ = window.unmaximize(); }
    else { let _ = window.maximize(); }
}

// ─── Launch game ──────────────────────────────────────────────────────────────
#[tauri::command]
fn launch_game(exec_path: String) -> Result<(), String> {
    std::process::Command::new(&exec_path)
        .spawn().map(|_| ()).map_err(|e| format!("Launch failed: {}", e))
}

// ─── Mod scanning ─────────────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Clone)]
pub struct ModInfo {
    pub id: String, pub name: String, pub path: String,
    pub enabled: bool, pub mod_type: String, pub size_mb: f64,
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
        let clean = raw.trim_start_matches("DISABLED_")
            .trim_end_matches(".pak").trim_end_matches(".asi").trim_end_matches(".dll").to_string();
        let size_mb = if ep.is_dir() { dir_size(&ep) as f64 / 1_048_576.0 }
            else { entry.metadata().map(|m| m.len()).unwrap_or(0) as f64 / 1_048_576.0 };
        mods.push(ModInfo { id: ps.clone(), name: clean, path: ps, enabled,
            mod_type: mod_type.to_string(), size_mb: (size_mb * 10.0).round() / 10.0 });
    }
    mods.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(mods)
}

fn dir_size(p: &Path) -> u64 {
    fs::read_dir(p).map(|e| e.flatten().map(|x| {
        let xp = x.path();
        if xp.is_file() { x.metadata().map(|m| m.len()).unwrap_or(0) } else { dir_size(&xp) }
    }).sum()).unwrap_or(0)
}

// ─── Toggle / delete mod ──────────────────────────────────────────────────────
#[tauri::command]
fn toggle_mod(mod_path: String, enable: bool) -> Result<String, String> {
    let path = Path::new(&mod_path);
    let parent = path.parent().ok_or("No parent")?;
    let raw = path.file_name().ok_or("No filename")?.to_string_lossy().to_string();
    let new_name = if enable { raw.trim_start_matches("DISABLED_").to_string() }
        else { if raw.starts_with("DISABLED_") { return Ok(mod_path); } format!("DISABLED_{}", raw) };
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

// ─── Filesystem helpers ───────────────────────────────────────────────────────
#[tauri::command] fn ensure_dir(path: String) -> Result<(), String> { fs::create_dir_all(&path).map_err(|e| e.to_string()) }
#[tauri::command] fn path_exists(p: String) -> bool { Path::new(&p).exists() }

#[tauri::command]
fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    fs::write(&path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn extract_zip_bytes(data: Vec<u8>, dest_path: String) -> Result<(), String> {
    use std::io::Cursor;
    let mut archive = zip::ZipArchive::new(Cursor::new(data)).map_err(|e| e.to_string())?;
    let dest = Path::new(&dest_path);
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let out = match file.enclosed_name() { Some(n) => dest.join(n), None => continue };
        if file.is_dir() { fs::create_dir_all(&out).map_err(|e| e.to_string())?; }
        else {
            if let Some(p) = out.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }
            let mut outfile = fs::File::create(&out).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ─── Guess mods path from exe ─────────────────────────────────────────────────
#[tauri::command]
fn guess_mods_path(exec_path: String) -> Option<String> {
    let exe = Path::new(&exec_path);
    let dir = exe.parent()?;
    let mut candidates: Vec<PathBuf> = vec![];
    // UE5 structure: exe in Binaries/Win64 → Content/Paks/~mods
    if let Some(binaries) = dir.parent() {
        if let Some(game_module) = binaries.parent() {
            candidates.push(game_module.join("Content").join("Paks").join("~mods"));
            candidates.push(game_module.join("Content").join("Paks").join("Mods"));
            if let Some(root) = game_module.parent() {
                candidates.push(root.join("Content").join("Paks").join("~mods"));
            }
        }
    }
    candidates.push(dir.join("~mods"));
    candidates.push(dir.join("Mods"));
    if let Some(p) = dir.parent() {
        candidates.push(p.join("Mods"));
        candidates.push(p.join("~mods"));
    }
    for c in &candidates { if c.exists() { return Some(c.to_string_lossy().to_string()); } }
    candidates.first().map(|p| p.to_string_lossy().to_string())
}

// ─── Steam library parser ─────────────────────────────────────────────────────
fn find_steam_libraries() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = vec![];
    // Common default paths
    let defaults = [
        "C:\\Program Files (x86)\\Steam",
        "C:\\Program Files\\Steam",
        "D:\\Steam", "E:\\Steam", "F:\\Steam",
        "/home/.steam/steam", "/home/.local/share/Steam",
        "/Applications/Steam.app/Contents",
    ];
    for d in &defaults {
        let p = PathBuf::from(d);
        if p.exists() { roots.push(p.clone()); parse_vdf_libraries(&p, &mut roots); }
    }
    // Also scan all drive letters for Steam
    #[cfg(windows)]
    for letter in &["D:", "E:", "F:", "G:", "H:"] {
        let p = PathBuf::from(format!("{}\\Steam", letter));
        if p.exists() { roots.push(p.clone()); parse_vdf_libraries(&p, &mut roots); }
        let p2 = PathBuf::from(format!("{}\\SteamLibrary", letter));
        if p2.exists() { roots.push(p2.clone()); parse_vdf_libraries(&p2, &mut roots); }
    }
    roots.dedup();
    roots
}

fn parse_vdf_libraries(steam_root: &Path, out: &mut Vec<PathBuf>) {
    let vdf = steam_root.join("steamapps").join("libraryfolders.vdf");
    if !vdf.exists() { return; }
    if let Ok(content) = fs::read_to_string(&vdf) {
        for line in content.lines() {
            let line = line.trim();
            if line.contains("\"path\"") {
                let parts: Vec<&str> = line.splitn(3, '"').collect();
                if parts.len() >= 5 {
                    let raw_path = parts[4].replace("\\\\", "\\");
                    let p = PathBuf::from(&raw_path);
                    if p.exists() { out.push(p); }
                }
            }
        }
    }
}

// ─── Auto-detect games ────────────────────────────────────────────────────────
#[derive(Serialize)]
pub struct DetectedGame {
    pub name: String, pub path: String, pub exec_path: String, pub game_id: u64,
}

const GAME_SIGS: &[(&str, &str, u64, &[&str])] = &[
    ("Neverness to Everness", "NTE.exe", 20920, &[
        "Neverness to Everness", "NTE",
    ]),
    ("Genshin Impact", "GenshinImpact.exe", 7545, &[
        "Genshin Impact", "Genshin Impact game",
    ]),
    ("Honkai: Star Rail", "StarRail.exe", 18874, &[
        "Honkai Star Rail", "Star Rail",
    ]),
    ("Zenless Zone Zero", "ZenlessZoneZero.exe", 20292, &[
        "ZenlessZoneZero Game", "Zenless Zone Zero",
    ]),
    ("Wuthering Waves", "Wuthering Waves.exe", 20545, &[
        "Wuthering Waves Game", "Wuthering Waves",
    ]),
    ("Cyberpunk 2077", "Cyberpunk2077.exe", 7371, &[
        "Cyberpunk 2077",
    ]),
    ("The Witcher 3", "witcher3.exe", 952, &[
        "The Witcher 3",
    ]),
    ("Elden Ring", "eldenring.exe", 1261, &[
        "ELDEN RING", "Elden Ring",
    ]),
];

fn find_exe_in_dir(dir: &Path, exe_name: &str) -> Option<PathBuf> {
    // Direct match
    let direct = dir.join(exe_name);
    if direct.exists() { return Some(direct); }
    // One level deep
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let ep = entry.path();
            if ep.is_dir() {
                let candidate = ep.join(exe_name);
                if candidate.exists() { return Some(candidate); }
                // Two levels deep (e.g. Binaries/Win64/game.exe)
                if let Ok(sub) = fs::read_dir(&ep) {
                    for sub_entry in sub.flatten() {
                        let sep = sub_entry.path();
                        if sep.is_dir() {
                            let c2 = sep.join(exe_name);
                            if c2.exists() { return Some(c2); }
                        }
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
fn detect_games() -> Vec<DetectedGame> {
    let mut found: Vec<DetectedGame> = vec![];
    let steam_libs = find_steam_libraries();

    // Check Steam libraries
    for lib in &steam_libs {
        let common = lib.join("steamapps").join("common");
        if !common.exists() { continue; }
        if let Ok(games) = fs::read_dir(&common) {
            for game_dir_entry in games.flatten() {
                let game_dir = game_dir_entry.path();
                if !game_dir.is_dir() { continue; }
                let dir_name = game_dir_entry.file_name().to_string_lossy().to_string();
                for (name, exe, gb_id, folder_names) in GAME_SIGS {
                    let matches = folder_names.iter().any(|f| dir_name.to_lowercase().contains(&f.to_lowercase()));
                    if matches {
                        if let Some(exe_path) = find_exe_in_dir(&game_dir, exe) {
                            found.push(DetectedGame {
                                name: name.to_string(), path: game_dir.to_string_lossy().to_string(),
                                exec_path: exe_path.to_string_lossy().to_string(), game_id: *gb_id,
                            });
                        }
                    }
                }
            }
        }
    }

    // Check Epic Games
    #[cfg(windows)]
    {
        let epic_paths = [
            "C:\\Program Files\\Epic Games",
            "D:\\Epic Games", "E:\\Epic Games",
            "C:\\Program Files (x86)\\Epic Games",
        ];
        for base in &epic_paths {
            let p = Path::new(base);
            if !p.exists() { continue; }
            if let Ok(entries) = fs::read_dir(p) {
                for entry in entries.flatten() {
                    let game_dir = entry.path();
                    if !game_dir.is_dir() { continue; }
                    let dir_name = entry.file_name().to_string_lossy().to_string();
                    for (name, exe, gb_id, folder_names) in GAME_SIGS {
                        let matches = folder_names.iter().any(|f| dir_name.to_lowercase().contains(&f.to_lowercase()));
                        if matches {
                            if let Some(exe_path) = find_exe_in_dir(&game_dir, exe) {
                                found.push(DetectedGame {
                                    name: name.to_string(), path: game_dir.to_string_lossy().to_string(),
                                    exec_path: exe_path.to_string_lossy().to_string(), game_id: *gb_id,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Check common non-Steam paths
    #[cfg(windows)]
    for drive in &["C:", "D:", "E:", "F:", "G:"] {
        for dir in &["\\Games", "\\logiciel jeux", "\\jeux", "\\Program Files"] {
            let base = PathBuf::from(format!("{}{}", drive, dir));
            if !base.exists() { continue; }
            if let Ok(entries) = fs::read_dir(&base) {
                for entry in entries.flatten() {
                    let game_dir = entry.path();
                    if !game_dir.is_dir() { continue; }
                    let dir_name = entry.file_name().to_string_lossy().to_string();
                    for (name, exe, gb_id, folder_names) in GAME_SIGS {
                        let matches = folder_names.iter().any(|f| dir_name.to_lowercase().contains(&f.to_lowercase()));
                        if matches {
                            if let Some(exe_path) = find_exe_in_dir(&game_dir, exe) {
                                found.push(DetectedGame {
                                    name: name.to_string(), path: game_dir.to_string_lossy().to_string(),
                                    exec_path: exe_path.to_string_lossy().to_string(), game_id: *gb_id,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    found.dedup_by_key(|g| g.exec_path.clone());
    found
}

// ─── Open URL ─────────────────────────────────────────────────────────────────
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
            launch_game,
            scan_mods, toggle_mod, delete_mod,
            ensure_dir, path_exists, write_file, extract_zip_bytes,
            guess_mods_path,
            detect_games,
            open_url,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| eprintln!("ZAILON error: {}", e));
}
