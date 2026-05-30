use tauri::WebviewWindow;
use std::path::{Path, PathBuf};
use std::fs;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

// ─── Discord RPC state ────────────────────────────────────────────────────────
const DISCORD_APP_ID: u64 = 1509971526987022497;
static DISCORD: Mutex<Option<discord_presence::Client>> = Mutex::new(None);

// ─── Window controls ──────────────────────────────────────────────────────────
#[tauri::command] fn close_window(window: WebviewWindow) { let _ = window.close(); }
#[tauri::command] fn minimize_window(window: WebviewWindow) { let _ = window.minimize(); }
#[tauri::command] fn toggle_maximize(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) { let _ = window.unmaximize(); }
    else { let _ = window.maximize(); }
}

// ─── Discord RPC ──────────────────────────────────────────────────────────────
#[tauri::command]
fn discord_start(state: String, details: String) {
    let mut guard = DISCORD.lock().unwrap();
    if guard.is_none() {
        let mut client = discord_presence::Client::new(DISCORD_APP_ID);
        client.on_ready(|_| {});
        if client.start().is_ok() { *guard = Some(client); }
    }
    if let Some(ref mut client) = *guard {
        let _ = client.set_activity(|a| {
            a.state(state.clone()).details(details.clone())
                .assets(|ass| ass.large_image("zailon_logo").large_text("ZAILON"))
        });
    }
}

#[tauri::command]
fn discord_stop() {
    let mut guard = DISCORD.lock().unwrap();
    if let Some(ref mut client) = *guard {
        let _ = client.clear_activity();
    }
    *guard = None;
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
        let mod_type = if ep.is_dir() { if raw.starts_with('.') { continue; } "folder" }
            else if raw.ends_with(".pak") { "pak" }
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
    if p.is_dir() { fs::remove_dir_all(p) } else { fs::remove_file(p) }.map_err(|e| e.to_string())
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

// ─── In-app update installer ──────────────────────────────────────────────────
#[tauri::command]
fn install_update(installer_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if installer_path.ends_with(".msi") {
            std::process::Command::new("msiexec")
                .args(["/i", &installer_path, "/quiet", "/norestart"])
                .spawn().map_err(|e| e.to_string())?;
        } else {
            std::process::Command::new(&installer_path)
                .args(["/S"]) // Silent install for NSIS
                .spawn().map_err(|e| e.to_string())?;
        }
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&installer_path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("sh").arg(&installer_path).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── Get temp dir path ────────────────────────────────────────────────────────
#[tauri::command]
fn get_temp_dir() -> String {
    std::env::temp_dir().to_string_lossy().to_string()
}

// ─── Guess mods path ──────────────────────────────────────────────────────────
#[tauri::command]
fn guess_mods_path(exec_path: String) -> Option<String> {
    let exe = Path::new(&exec_path);
    let dir = exe.parent()?;
    let mut candidates: Vec<PathBuf> = vec![];
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

// ─── Steam VDF library parser ─────────────────────────────────────────────────
fn find_steam_libraries() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = vec![];
    let defaults: Vec<String> = {
        let mut d = vec![
            "C:\\Program Files (x86)\\Steam".to_string(),
            "C:\\Program Files\\Steam".to_string(),
        ];
        #[cfg(windows)]
        for letter in &["D", "E", "F", "G", "H"] {
            d.push(format!("{}:\\Steam", letter));
            d.push(format!("{}:\\SteamLibrary", letter));
            d.push(format!("{}:\\Games\\Steam", letter));
        }
        #[cfg(not(windows))]
        { d.push(format!("{}/.steam/steam", std::env::var("HOME").unwrap_or_default())); }
        d
    };
    for d in &defaults {
        let p = PathBuf::from(d);
        if p.exists() { parse_vdf_libraries(&p, &mut roots); roots.push(p); }
    }
    roots.dedup();
    roots
}

fn parse_vdf_libraries(steam_root: &Path, out: &mut Vec<PathBuf>) {
    let vdf = steam_root.join("steamapps").join("libraryfolders.vdf");
    if !vdf.exists() { return; }
    if let Ok(content) = fs::read_to_string(&vdf) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.contains("\"path\"") {
                // Format: "path"		"D:\\Games"
                if let Some(start) = trimmed.rfind('"') {
                    let s = &trimmed[..start];
                    if let Some(end) = s.rfind('"') {
                        let raw = trimmed[end+1..start].replace("\\\\", "\\");
                        let p = PathBuf::from(&raw);
                        if p.exists() { out.push(p); }
                    }
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
    ("Neverness to Everness", "NTE.exe", 20920, &["Neverness to Everness", "NTE"]),
    ("Genshin Impact", "GenshinImpact.exe", 7545, &["Genshin Impact", "GenshinImpact"]),
    ("Honkai: Star Rail", "StarRail.exe", 18874, &["Honkai Star Rail", "Star Rail", "StarRail"]),
    ("Zenless Zone Zero", "ZenlessZoneZero.exe", 20292, &["ZenlessZoneZero", "Zenless Zone Zero"]),
    ("Wuthering Waves", "Wuthering Waves.exe", 20545, &["Wuthering Waves", "WutheringWaves"]),
    ("Cyberpunk 2077", "Cyberpunk2077.exe", 7371, &["Cyberpunk 2077", "Cyberpunk2077"]),
    ("Elden Ring", "eldenring.exe", 1261, &["ELDEN RING", "Elden Ring"]),
    ("The Witcher 3", "witcher3.exe", 952, &["The Witcher 3", "Witcher3"]),
];

fn find_exe_in_dir(dir: &Path, exe_name: &str) -> Option<PathBuf> {
    let direct = dir.join(exe_name);
    if direct.exists() { return Some(direct); }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let ep = entry.path();
            if ep.is_dir() {
                let c = ep.join(exe_name);
                if c.exists() { return Some(c); }
                if let Ok(sub) = fs::read_dir(&ep) {
                    for se in sub.flatten() {
                        let sep = se.path();
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

    // Steam libraries
    for lib in find_steam_libraries() {
        let common = lib.join("steamapps").join("common");
        if !common.exists() { continue; }
        if let Ok(dirs) = fs::read_dir(&common) {
            for dir_entry in dirs.flatten() {
                let game_dir = dir_entry.path();
                if !game_dir.is_dir() { continue; }
                let dir_name = dir_entry.file_name().to_string_lossy().to_lowercase();
                for (name, exe, gb_id, keywords) in GAME_SIGS {
                    if keywords.iter().any(|k| dir_name.contains(&k.to_lowercase())) {
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

    // Additional scan paths
    let extra_paths: Vec<String> = {
        let mut p = vec![];
        #[cfg(windows)]
        for drive in &["C", "D", "E", "F", "G"] {
            for dir in &["Games", "logiciel jeux", "jeux", "Program Files", "Epic Games"] {
                p.push(format!("{}:\\{}", drive, dir));
            }
        }
        p
    };

    for base_str in &extra_paths {
        let base = PathBuf::from(base_str);
        if !base.exists() { continue; }
        if let Ok(dirs) = fs::read_dir(&base) {
            for dir_entry in dirs.flatten() {
                let game_dir = dir_entry.path();
                if !game_dir.is_dir() { continue; }
                let dir_name = dir_entry.file_name().to_string_lossy().to_lowercase();
                for (name, exe, gb_id, keywords) in GAME_SIGS {
                    if keywords.iter().any(|k| dir_name.contains(&k.to_lowercase())) {
                        if let Some(exe_path) = find_exe_in_dir(&game_dir, exe) {
                            if !found.iter().any(|f| f.exec_path == exe_path.to_string_lossy()) {
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

    found
}

// ─── Open URL ─────────────────────────────────────────────────────────────────
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { std::process::Command::new("cmd").args(["/c", "start", "", &url]).spawn().map_err(|e| e.to_string())?; }
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
            guess_mods_path, detect_games,
            discord_start, discord_stop,
            install_update, get_temp_dir,
            open_url,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| eprintln!("ZAILON error: {}", e));
}
