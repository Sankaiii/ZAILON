// Use @tauri-apps/plugin-dialog JS API directly — more reliable than Rust mpsc bridge

export async function pickExeFile(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const result = await open({
      multiple: false,
      filters: [
        { name: 'Executable', extensions: ['exe', 'app', 'AppImage'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return typeof result === 'string' ? result : null
  } catch { return null }
}

export async function pickFolder(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const result = await open({ directory: true, multiple: false })
    return typeof result === 'string' ? result : null
  } catch { return null }
}

export async function pickImageFile(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const result = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'svg'] }]
    })
    return typeof result === 'string' ? result : null
  } catch { return null }
}
