import { useEffect, useState } from "react";
import { Server, X } from "lucide-react";
import type { ProjectRecord, RemoteServerConfig } from "@shared/types";

type RemoteProjectModalProps = {
  serverConfigs?: RemoteServerConfig[];
  onClose: () => void;
  onCreate: (project: ProjectRecord) => void;
};

const palette = ["#E76F51", "#2A9D8F", "#E9C46A", "#457B9D", "#F4A261", "#8AB17D"];

export function RemoteProjectModal({ serverConfigs = [], onClose, onCreate }: RemoteProjectModalProps) {
  const [selectedServerId, setSelectedServerId] = useState("");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [rootPath, setRootPath] = useState("~/");
  const [sshProfile, setSshProfile] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!selectedServerId) {
      return;
    }

    const selectedServer = serverConfigs.find((entry) => entry.id === selectedServerId);
    if (!selectedServer) {
      return;
    }

    setName(selectedServer.name);
    setHost(selectedServer.host);
    setRootPath(selectedServer.rootPath ?? "~/");
    setSshProfile(selectedServer.sshProfile ?? "");
    setPreviewUrl(selectedServer.previewUrl ?? "");
  }, [selectedServerId, serverConfigs]);

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card--remote">
        <div className="modal-card__header">
          <div>
            <div className="eyebrow">Remote Project</div>
            <h2>Add SSH workspace</h2>
          </div>
          <button className="dialog-close-button" onClick={onClose} aria-label="Close remote project dialog">
            <X size={15} strokeWidth={2.1} />
          </button>
        </div>

        <form
          className="modal-form modal-form--remote"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedHost = host.trim();
            const trimmedRoot = rootPath.trim();
            if (!trimmedHost || !trimmedRoot) {
              return;
            }

            onCreate({
              id: `remote-${Date.now()}`,
              name: name.trim() || trimmedHost,
              kind: "remote",
              host: trimmedHost,
              sshProfile: sshProfile.trim() || undefined,
              rootPath: trimmedRoot,
              previewUrl: previewUrl.trim(),
              color: palette[Math.floor(Math.random() * palette.length)]
            });
          }}
        >
          <div className="remote-project-layout">
            <div className="remote-project-intro">
              <div className="remote-project-intro__icon">
                <Server size={16} strokeWidth={1.9} />
              </div>
              <div className="remote-project-intro__copy">
                <strong>Connect a remote code space</strong>
                <span>Save a quick SSH-backed project with an optional preview URL.</span>
              </div>
            </div>

            {serverConfigs.length > 0 ? (
              <label className="field remote-project-field remote-project-field--wide">
                <span>Saved Server</span>
                <select value={selectedServerId} onChange={(event) => setSelectedServerId(event.target.value)}>
                  <option value="">Custom</option>
                  {serverConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="remote-project-grid">
              <label className="field remote-project-field">
                <span>Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="api-prod" />
              </label>

              <label className="field remote-project-field">
                <span>Host</span>
                <input
                  value={host}
                  onChange={(event) => setHost(event.target.value)}
                  placeholder="ubuntu@my-server"
                  required
                />
              </label>

              <label className="field remote-project-field">
                <span>SSH Profile</span>
                <input
                  value={sshProfile}
                  onChange={(event) => setSshProfile(event.target.value)}
                  placeholder="Optional alias"
                />
              </label>

              <label className="field remote-project-field">
                <span>Remote Root Path</span>
                <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} required />
              </label>

              <label className="field remote-project-field remote-project-field--wide">
                <span>Preview URL</span>
                <input value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} placeholder="http://localhost:3000" />
              </label>
            </div>
          </div>

          <div className="modal-card__actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Server size={14} strokeWidth={2} />
              Add Remote Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
