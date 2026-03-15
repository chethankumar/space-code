import { useMemo, useState } from "react";
import { Check, MonitorCog, MoonStar, Palette, Server, SunMedium, Type, X } from "lucide-react";
import type {
  AppSettings,
  AppTheme,
  CodeThemePreset,
  EditorTheme,
  RemoteServerConfig,
  TerminalThemePreset
} from "@shared/types";

type SettingsDialogProps = {
  settings: AppSettings;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onUpsertRemoteServer: (config: RemoteServerConfig) => void;
  onRemoveRemoteServer: (configId: string) => void;
};

const editorThemeOptions: Array<{ value: EditorTheme; label: string; swatches: string[] }> = [
  { value: "spacecode-dark", label: "SpaceCode Dark", swatches: ["#0d131d", "#8cb4ff", "#9fdc9c"] },
  { value: "spacecode-light", label: "SpaceCode Light", swatches: ["#f9fbff", "#3566d6", "#2f7d4f"] },
  { value: "github-dark", label: "GitHub Dark", swatches: ["#0d1117", "#ff7b72", "#79c0ff"] },
  { value: "github-light", label: "GitHub Light", swatches: ["#ffffff", "#cf222e", "#0969da"] },
  { value: "dracula", label: "Dracula", swatches: ["#282a36", "#ff79c6", "#f1fa8c"] },
  { value: "nord", label: "Nord", swatches: ["#2e3440", "#81a1c1", "#a3be8c"] },
  { value: "solarized-dark", label: "Solarized Dark", swatches: ["#002b36", "#859900", "#2aa198"] },
  { value: "solarized-light", label: "Solarized Light", swatches: ["#fdf6e3", "#859900", "#268bd2"] },
  { value: "hc-black", label: "High Contrast", swatches: ["#000000", "#ffffff", "#ffff00"] }
];

const terminalThemeOptions: Array<{ value: TerminalThemePreset; label: string; swatches: string[] }> = [
  { value: "spacecode-dark", label: "SpaceCode Dark", swatches: ["#090f18", "#e6edf3", "#2f7df4"] },
  { value: "spacecode-light", label: "SpaceCode Light", swatches: ["#f8fafc", "#1f2937", "#2563eb"] },
  { value: "github-dark", label: "GitHub Dark", swatches: ["#0d1117", "#c9d1d9", "#58a6ff"] },
  { value: "github-light", label: "GitHub Light", swatches: ["#ffffff", "#1f2328", "#0969da"] },
  { value: "dracula", label: "Dracula", swatches: ["#282a36", "#f8f8f2", "#ff79c6"] },
  { value: "nord", label: "Nord", swatches: ["#2e3440", "#d8dee9", "#88c0d0"] },
  { value: "solarized-dark", label: "Solarized Dark", swatches: ["#002b36", "#93a1a1", "#268bd2"] },
  { value: "solarized-light", label: "Solarized Light", swatches: ["#fdf6e3", "#586e75", "#268bd2"] },
  { value: "gruvbox-dark", label: "Gruvbox Dark", swatches: ["#282828", "#ebdbb2", "#fabd2f"] }
];

const codeThemeOptions: Array<{ value: CodeThemePreset; label: string; swatches: string[] }> = [
  { value: "spacecode-dark", label: "SpaceCode Dark", swatches: ["#0b1220", "#dce8ff", "#3b82f6"] },
  { value: "spacecode-light", label: "SpaceCode Light", swatches: ["#f8fbff", "#1f2937", "#2563eb"] },
  { value: "github-dark", label: "GitHub Dark", swatches: ["#0d1117", "#c9d1d9", "#58a6ff"] },
  { value: "github-light", label: "GitHub Light", swatches: ["#ffffff", "#1f2328", "#0969da"] },
  { value: "dracula", label: "Dracula", swatches: ["#282a36", "#f8f8f2", "#ff79c6"] },
  { value: "nord", label: "Nord", swatches: ["#2e3440", "#d8dee9", "#88c0d0"] },
  { value: "solarized-dark", label: "Solarized Dark", swatches: ["#002b36", "#93a1a1", "#268bd2"] },
  { value: "solarized-light", label: "Solarized Light", swatches: ["#fdf6e3", "#586e75", "#268bd2"] },
  { value: "gruvbox-dark", label: "Gruvbox Dark", swatches: ["#282828", "#ebdbb2", "#fabd2f"] },
  { value: "hc-black", label: "High Contrast", swatches: ["#000000", "#ffffff", "#ffff00"] }
];

export function SettingsDialog({
  settings,
  onClose,
  onUpdateSettings,
  onUpsertRemoteServer,
  onRemoveRemoteServer
}: SettingsDialogProps) {
  const [draftServer, setDraftServer] = useState<RemoteServerConfig>({
    id: "",
    name: "",
    host: "",
    sshProfile: "",
    rootPath: "~/",
    previewUrl: ""
  });

  const sortedServers = useMemo(
    () => [...settings.remoteServers].sort((left, right) => left.name.localeCompare(right.name)),
    [settings.remoteServers]
  );

  const resetDraft = () =>
    setDraftServer({
      id: "",
      name: "",
      host: "",
      sshProfile: "",
      rootPath: "~/",
      previewUrl: ""
    });

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card--settings">
        <div className="modal-card__header">
          <div>
            <div className="eyebrow">Application Settings</div>
            <h2>SpaceCode Preferences</h2>
          </div>
          <button className="dialog-close-button" onClick={onClose} aria-label="Close settings">
            <X size={15} strokeWidth={2.1} />
          </button>
        </div>

        <div className="settings-layout">
          <section className="settings-section">
            <div className="settings-section__heading">
              <Palette size={16} strokeWidth={1.9} />
              <span>Appearance</span>
            </div>
            <div className="settings-grid settings-grid--two">
              <label className="field">
                <span>App Theme</span>
                <div className="segmented-control">
                  {(["auto", "dark", "light"] as const).map((theme) => (
                    <button
                      key={theme}
                      className={theme === settings.theme ? "segmented-control__button segmented-control__button--active" : "segmented-control__button"}
                      onClick={() => onUpdateSettings({ theme: theme as AppTheme })}
                      type="button"
                    >
                      {theme === "auto" ? (
                        <MonitorCog size={14} strokeWidth={1.9} />
                      ) : theme === "dark" ? (
                        <MoonStar size={14} strokeWidth={1.9} />
                      ) : (
                        <SunMedium size={14} strokeWidth={1.9} />
                      )}
                      <span>{theme === "auto" ? "Auto" : theme === "dark" ? "Dark" : "Light"}</span>
                    </button>
                  ))}
                </div>
              </label>
              <div className="settings-note-card">
                <strong>Global shell theme</strong>
                <span>Controls the SpaceCode chrome, sidebars, dialogs, and shared interface surfaces.</span>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <Type size={16} strokeWidth={1.9} />
              <span>Editor</span>
            </div>
            <div className="settings-grid settings-grid--compact">
              <label className="field">
                <span>Font Family</span>
                <input
                  value={settings.editorFontFamily}
                  onChange={(event) => onUpdateSettings({ editorFontFamily: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Font Size</span>
                <input
                  type="number"
                  min="11"
                  max="24"
                  value={settings.editorFontSize}
                  onChange={(event) => onUpdateSettings({ editorFontSize: Number(event.target.value) || 13 })}
                />
              </label>
              <label className="field">
                <span>Color Theme</span>
                <div className="theme-card-grid">
                  {editorThemeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.value === settings.editorTheme ? "theme-card theme-card--active" : "theme-card"}
                      onClick={() => onUpdateSettings({ editorTheme: option.value })}
                      aria-pressed={option.value === settings.editorTheme}
                    >
                      <span className="theme-card__swatches">
                        {option.swatches.map((swatch) => (
                          <span key={swatch} className="theme-card__swatch" style={{ background: swatch }} />
                        ))}
                      </span>
                      <span className="theme-card__label">{option.label}</span>
                      {option.value === settings.editorTheme ? (
                        <span className="theme-card__selected">
                          <Check size={12} strokeWidth={2.2} />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <Palette size={16} strokeWidth={1.9} />
              <span>Code Surface</span>
            </div>
            <div className="settings-grid settings-grid--compact">
              <label className="field">
                <span>Theme</span>
                <div className="theme-card-grid">
                  {codeThemeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.value === settings.codeTheme ? "theme-card theme-card--active" : "theme-card"}
                      onClick={() => onUpdateSettings({ codeTheme: option.value })}
                      aria-pressed={option.value === settings.codeTheme}
                    >
                      <span className="theme-card__swatches">
                        {option.swatches.map((swatch) => (
                          <span key={swatch} className="theme-card__swatch" style={{ background: swatch }} />
                        ))}
                      </span>
                      <span className="theme-card__label">{option.label}</span>
                      {option.value === settings.codeTheme ? (
                        <span className="theme-card__selected">
                          <Check size={12} strokeWidth={2.2} />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <MonitorCog size={16} strokeWidth={1.9} />
              <span>Terminal</span>
            </div>
            <div className="settings-grid settings-grid--compact">
              <label className="field">
                <span>Font Family</span>
                <input
                  value={settings.terminalFontFamily}
                  onChange={(event) => onUpdateSettings({ terminalFontFamily: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Font Size</span>
                <input
                  type="number"
                  min="11"
                  max="24"
                  value={settings.terminalFontSize}
                  onChange={(event) => onUpdateSettings({ terminalFontSize: Number(event.target.value) || 13 })}
                />
              </label>
              <label className="field">
                <span>Color Theme</span>
                <div className="theme-card-grid">
                  {terminalThemeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        option.value === settings.terminalTheme ? "theme-card theme-card--active" : "theme-card"
                      }
                      onClick={() => onUpdateSettings({ terminalTheme: option.value })}
                      aria-pressed={option.value === settings.terminalTheme}
                    >
                      <span className="theme-card__swatches">
                        {option.swatches.map((swatch) => (
                          <span key={swatch} className="theme-card__swatch" style={{ background: swatch }} />
                        ))}
                      </span>
                      <span className="theme-card__label">{option.label}</span>
                      {option.value === settings.terminalTheme ? (
                        <span className="theme-card__selected">
                          <Check size={12} strokeWidth={2.2} />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <Server size={16} strokeWidth={1.9} />
              <span>Remote Servers</span>
            </div>

            <div className="settings-servers">
              <div className="settings-server-list">
                {sortedServers.length === 0 ? (
                  <div className="settings-empty">No saved remote server configs yet.</div>
                ) : (
                  sortedServers.map((server) => (
                    <div key={server.id} className="settings-server-card">
                      <div className="settings-server-card__body">
                        <strong>{server.name}</strong>
                        <span>{server.host}</span>
                        <span>{server.rootPath || "~/"}</span>
                      </div>
                      <div className="settings-server-card__actions">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setDraftServer(server)}
                        >
                          Edit
                        </button>
                        <button
                          className="ghost-button settings-server-card__danger"
                          type="button"
                          onClick={() => onRemoveRemoteServer(server.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                className="settings-server-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draftServer.name.trim() || !draftServer.host.trim()) {
                    return;
                  }
                  onUpsertRemoteServer({
                    ...draftServer,
                    id: draftServer.id || `remote-config-${Date.now()}`,
                    name: draftServer.name.trim(),
                    host: draftServer.host.trim(),
                    sshProfile: draftServer.sshProfile?.trim() || undefined,
                    rootPath: draftServer.rootPath?.trim() || undefined,
                    previewUrl: draftServer.previewUrl?.trim() || undefined
                  });
                  resetDraft();
                }}
              >
                <div className="settings-server-form__heading">
                  {draftServer.id ? "Edit remote config" : "New remote config"}
                </div>
                <div className="settings-grid settings-grid--two">
                  <label className="field">
                    <span>Name</span>
                    <input
                      value={draftServer.name}
                      onChange={(event) => setDraftServer((current) => ({ ...current, name: event.target.value }))}
                      placeholder="api-prod"
                    />
                  </label>
                  <label className="field">
                    <span>Host</span>
                    <input
                      value={draftServer.host}
                      onChange={(event) => setDraftServer((current) => ({ ...current, host: event.target.value }))}
                      placeholder="ubuntu@server"
                    />
                  </label>
                  <label className="field">
                    <span>SSH Profile</span>
                    <input
                      value={draftServer.sshProfile ?? ""}
                      onChange={(event) =>
                        setDraftServer((current) => ({ ...current, sshProfile: event.target.value }))
                      }
                      placeholder="Optional ~/.ssh/config alias"
                    />
                  </label>
                  <label className="field">
                    <span>Root Path</span>
                    <input
                      value={draftServer.rootPath ?? ""}
                      onChange={(event) => setDraftServer((current) => ({ ...current, rootPath: event.target.value }))}
                      placeholder="~/"
                    />
                  </label>
                  <label className="field settings-grid__span-two">
                    <span>Preview URL</span>
                    <input
                      value={draftServer.previewUrl ?? ""}
                      onChange={(event) =>
                        setDraftServer((current) => ({ ...current, previewUrl: event.target.value }))
                      }
                      placeholder="http://localhost:3000"
                    />
                  </label>
                </div>
                <div className="modal-card__actions">
                  <button type="button" className="ghost-button" onClick={resetDraft}>
                    Reset
                  </button>
                  <button type="submit" className="primary-button">
                    {draftServer.id ? "Update Server" : "Save Server"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
