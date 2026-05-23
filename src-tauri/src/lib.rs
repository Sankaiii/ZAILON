use tauri::WebviewWindow;
use std::path::{Path, PathBuf};
use std::fs;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

// ─── Global Discord state ─────────────────────────────────────────────────────
static DISCORD_ENABLED: Mutex<bool> = Mutex::new(false);

// ─── Window controls ──────────────────────────────────────────────────────────
#[tauri::command] fn close_window(window: WebviewWindow) { let _ = window.close(); }
#[tauri::command] fn minimize_window(window: WebviewWindow) { let _ = window.minimize(); }
#[tauri::command] fn toggle_maximize(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) { let _ = window.unmaximize(); }
    else { let _ = window.maximize(); }
}

// ─── Folder / file picker ─────────────────────────────────────────────────────
#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let r = app.dialog().file().pick_folder().blocking_pick();
    Ok(r.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
async fn pick_file(app: tauri::AppHandle, filter: String) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let r = app.dialog().file()
        .add_filter("Executable", &[&filter])
        .pick_file()
        .blocking_pick();
    Ok(r.map(|p| p.to_string_lossy().to_string()))
}

// ─── Launch game ──────────────────────────────────────────────────────────────
#[tauri::command]
fn launch_game(exec_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(&exec_path)
            .spawn()
            .map_err(|e| format!("Failed to launch: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(&exec_path)
            .spawn()
            .map_err(|e| format!("Failed to launch: {}", e))?;
    }
    Ok(())
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
        let display = if enabled { raw.trim_end_matches(".pak").trim_end_matches(".asi").trim_end_matches(".dll").to_string() }
            else { raw.trim_start_matches("DISABLED_").trim_end_matches(".pak").trim_end_matches(".asi").to_string() };
        let size_mb = if ep.is_dir() { dir_size(&ep) as f64 / 1_048_576.0 }
            else { entry.metadata().map(|m| m.len()).unwrap_or(0) as f64 / 1_048_576.0 };
        mods.push(ModInfo { id: ps.clone(), name: display, path: ps, enabled, mod_type: mod_type.to_string(),
            size_mb: (size_mb * 10.0).round() / 10.0 });
    }
    mods.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(mods)
}

fn dir_size(p: &Path) -> u64 {
    fs::read_dir(p).map(|e| e.flatten()
        .map(|x| { let xp = x.path(); if xp.is_file() { x.metadata().map(|m| m.len()).unwrap_or(0) } else { dir_size(&xp) } })
        .sum()).unwrap_or(0)
}

// ─── Toggle mod ───────────────────────────────────────────────────────────────
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
    if p.is_dir() { fs::remove_dir_all(p).map_err(|e| e.to_string()) }
    else { fs::remove_file(p).map_err(|e| e.to_string()) }
}

#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn path_exists(p: String) -> bool { Path::new(&p).exists() }

// ─── Install mod from URL (download + extract zip) ────────────────────────────
#[tauri::command]
async fn install_mod_from_url(url: String, mods_path: String, file_name: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let bytes = client.get(&url)
        .header("User-Agent", "ZAILON-Launcher/1.0")
        .send().await.map_err(|e| e.to_string())?
        .bytes().await.map_err(|e| e.to_string())?;

    let dest = PathBuf::from(&mods_path);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    if file_name.ends_with(".zip") {
        let cursor = std::io::Cursor::new(&bytes[..]);
        let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;
        let mod_name = file_name.trim_end_matches(".zip").to_string();
        let mod_dir = dest.join(&mod_name);
        fs::create_dir_all(&mod_dir).map_err(|e| e.to_string())?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = mod_dir.join(file.mangled_name());
            if file.name().ends_with('/') { fs::create_dir_all(&outpath).map_err(|e| e.to_string())?; }
            else {
                if let Some(p) = outpath.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }
                let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
        Ok(mod_dir.to_string_lossy().to_string())
    } else {
        // Single file mod (.pak, .asi)
        let out = dest.join(&file_name);
        fs::write(&out, &bytes[..]).map_err(|e| e.to_string())?;
        Ok(out.to_string_lossy().to_string())
    }
}

// ─── GameBanana API ───────────────────────────────────────────────────────────
#[derive(Serialize, Deserialize)]
pub struct GBMod {
    pub id: u64,
    pub name: String,
    pub author: String,
    pub downloads: u64,
    pub likes: u64,
    pub thumbnail: String,
    pub url: String,
    pub description: String,
    pub files: Vec<GBFile>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GBFile {
    pub id: u64,
    pub name: String,
    pub url: String,
    pub size: u64,
}

#[tauri::command]
async fn fetch_gamebanana(game_id: u64, search: String, page: u64) -> Result<Vec<GBMod>, String> {
    let client = reqwest::Client::builder()
        .user_agent("ZAILON-Launcher/1.0")
        .build().map_err(|e| e.to_string())?;

    let url = if search.is_empty() {
        format!("https://api.gamebanana.com/Core/List/New?gameid={}&itemtype=Mod&nPerPage=20&nPage={}&fields=id,name,Owner().name,Downloads().nDownloadCount(),Likes().nCount(),Preview().sSubFeedImageUrl(),description&bReturnMetadata=false", game_id, page)
    } else {
        format!("https://api.gamebanana.com/Core/Search/Results?sKeywords={}&gameid={}&itemtype=Mod&nPerPage=20&nPage={}&fields=id,name,Owner().name,Downloads().nDownloadCount(),Likes().nCount(),Preview().sSubFeedImageUrl(),description", search, game_id, page)
    };

    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let raw: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let mut mods = vec![];
    if let Some(arr) = raw.as_array() {
        for item in arr {
            if let Some(fields) = item.as_array() {
                let id = fields.get(0).and_then(|v| v.as_u64()).unwrap_or(0);
                let name = fields.get(1).and_then(|v| v.as_str()).unwrap_or("").to_string();
                let author = fields.get(2).and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                let downloads = fields.get(3).and_then(|v| v.as_u64()).unwrap_or(0);
                let likes = fields.get(4).and_then(|v| v.as_u64()).unwrap_or(0);
                let thumbnail = fields.get(5).and_then(|v| v.as_str()).unwrap_or("").to_string();
                let description = fields.get(6).and_then(|v| v.as_str()).unwrap_or("").to_string();
                let url = format!("https://gamebanana.com/mods/{}", id);
                mods.push(GBMod { id, name, author, downloads, likes, thumbnail, url, description, files: vec![] });
            }
        }
    }
    Ok(mods)
}

#[tauri::command]
async fn fetch_mod_files(mod_id: u64) -> Result<Vec<GBFile>, String> {
    let client = reqwest::Client::builder().user_agent("ZAILON-Launcher/1.0").build().map_err(|e| e.to_string())?;
    let url = format!("https://api.gamebanana.com/Core/Item/Data?itemtype=Mod&itemid={}&fields=Files().aFiles()", mod_id);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let raw: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let mut files = vec![];
    if let Some(arr) = raw.as_array() {
        if let Some(file_map) = arr.get(0).and_then(|v| v.as_object()) {
            for (_, fdata) in file_map {
                let id = fdata.get("_idRow").and_then(|v| v.as_u64()).unwrap_or(0);
                let name = fdata.get("_sFile").and_then(|v| v.as_str()).unwrap_or("mod.zip").to_string();
                let url = fdata.get("_sDownloadUrl").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let size = fdata.get("_nFilesize").and_then(|v| v.as_u64()).unwrap_or(0);
                if !url.is_empty() { files.push(GBFile { id, name, url, size }); }
            }
        }
    }
    Ok(files)
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
    let drives = &["C:", "D:", "E:", "F:", "G:", "H:"];
    let sigs: &[(&str, &str, u64, &[&str])] = &[
        ("Neverness to Everness", "NTE.exe", 20920, &[
            "\\HTGame\\Binaries\\Win64\\NTE.exe",
            "\\Binaries\\Win64\\NTE.exe",
            "\\NTE.exe",
        ]),
        ("Genshin Impact", "GenshinImpact.exe", 7545, &[
            "\\Genshin Impact\\GenshinImpact.exe",
            "\\GenshinImpact game\\GenshinImpact.exe",
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
    let common_dirs = &["\\Program Files", "\\Program Files (x86)", "\\Games", "\\logiciel jeux", "\\SteamLibrary\\steamapps\\common"];

    for drive in drives {
        for dir in common_dirs {
            for (name, exe, gb_id, paths) in sigs {
                for rel in *paths {
                    let full = format!("{}{}{}", drive, dir, rel);
                    if Path::new(&full).exists() {
                        let game_dir = Path::new(&full).parent().unwrap_or(Path::new("")).to_string_lossy().to_string();
                        found.push(DetectedGame { name: name.to_string(), path: game_dir, exec_path: full, game_id: *gb_id });
                        break;
                    }
                }
            }
        }
        // Also check Steam default
        let steam = format!("{}\\Steam\\steamapps\\common", drive);
        if Path::new(&steam).exists() {
            if let Ok(entries) = fs::read_dir(&steam) {
                for entry in entries.flatten() {
                    let ep = entry.path();
                    for (name, exe, gb_id, _) in sigs {
                        let exe_path = ep.join(exe);
                        if exe_path.exists() {
                            found.push(DetectedGame { name: name.to_string(), path: ep.to_string_lossy().to_string(), exec_path: exe_path.to_string_lossy().to_string(), game_id: *gb_id });
                        }
                    }
                }
            }
        }
    }

    // Deduplicate
    found.dedup_by_key(|g| g.exec_path.clone());
    found
}

// ─── Check for updates ────────────────────────────────────────────────────────
#[derive(Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: String,
    pub url: String,
    pub body: String,
}

#[tauri::command]
async fn check_for_updates() -> Result<UpdateInfo, String> {
    let client = reqwest::Client::builder().user_agent("ZAILON-Launcher/1.0").build().map_err(|e| e.to_string())?;
    let resp = client.get("https://api.github.com/repos/Sankaiii/ZAILON/releases/latest")
        .send().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let latest = json.get("tag_name").and_then(|v| v.as_str()).unwrap_or("").trim_start_matches('v').to_string();
    let current = env!("CARGO_PKG_VERSION");
    let url = json.get("html_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let body = json.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let available = !latest.is_empty() && latest != current;
    Ok(UpdateInfo { available, version: latest, url, body })
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

// ─── Download resource (background, icon) ────────────────────────────────────
#[tauri::command]
async fn fetch_resource_url(game_biz: String, resource_type: String) -> Result<Option<String>, String> {
    let base = "https://raw.githubusercontent.com/Sankaiii/Zailon-game/main/resources";
    let urls = [
        format!("{}/{}/{}.jpg", base, game_biz, resource_type),
        format!("{}/{}/{}.png", base, game_biz, resource_type),
        format!("{}/{}/{}.webp", base, game_biz, resource_type),
    ];
    let client = reqwest::Client::builder().user_agent("ZAILON-Launcher/1.0").build().map_err(|e| e.to_string())?;
    for url in &urls {
        if let Ok(resp) = client.head(url).send().await {
            if resp.status().is_success() { return Ok(Some(url.clone())); }
        }
    }
    Ok(None)
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
            install_mod_from_url,
            fetch_gamebanana, fetch_mod_files,
            detect_games,
            check_for_updates,
            open_url,
            fetch_resource_url,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| eprintln!("ZAILON error: {}", e));
}
