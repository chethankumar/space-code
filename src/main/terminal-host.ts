import os from "node:os";
import { existsSync } from "node:fs";
import * as pty from "node-pty";
import type { IPty } from "node-pty";
import type { ProjectRecord } from "../shared/types";

type HostRequest =
  | {
      type: "create-session";
      requestId: string;
      payload: {
        sessionId: string;
        sessionKind: "terminal";
        cwd?: string;
        project?: ProjectRecord;
      };
    }
  | {
      type: "write";
      payload: {
        sessionId: string;
        data: string;
      };
    }
  | {
      type: "resize";
      payload: {
        sessionId: string;
        cols: number;
        rows: number;
      };
    }
  | {
      type: "close";
      payload: {
        sessionId: string;
      };
    };

type HostResponse =
  | {
      type: "response";
      requestId: string;
      ok: true;
    }
  | {
      type: "response";
      requestId: string;
      ok: false;
      error: string;
    }
  | {
      type: "terminal-data";
      payload: {
        sessionId: string;
        data: string;
      };
    }
  | {
      type: "terminal-exit";
      payload: {
        sessionId: string;
        exitCode: number;
      };
    };

const sessions = new Map<string, IPty>();

process.on("message", (message: HostRequest) => {
  void handleMessage(message);
});

async function handleMessage(message: HostRequest) {
  switch (message.type) {
    case "create-session":
      try {
        const handle =
          message.payload.project?.kind === "remote"
            ? spawnRemotePty(message.payload.project, message.payload.cwd ?? process.cwd())
            : spawnLocalPty(message.payload.cwd ?? process.cwd());

        sessions.set(message.payload.sessionId, handle);
        handle.onData((data) => {
          send({
            type: "terminal-data",
            payload: {
              sessionId: message.payload.sessionId,
              data
            }
          });
        });
        handle.onExit(({ exitCode }) => {
          sessions.delete(message.payload.sessionId);
          send({
            type: "terminal-exit",
            payload: {
              sessionId: message.payload.sessionId,
              exitCode
            }
          });
        });

        send({
          type: "response",
          requestId: message.requestId,
          ok: true
        });
      } catch (error) {
        send({
          type: "response",
          requestId: message.requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return;

    case "write": {
      const session = sessions.get(message.payload.sessionId);
      if (session) {
        session.write(message.payload.data);
      }
      return;
    }

    case "resize": {
      const session = sessions.get(message.payload.sessionId);
      if (session) {
        session.resize(message.payload.cols, message.payload.rows);
      }
      return;
    }

    case "close": {
      const session = sessions.get(message.payload.sessionId);
      if (session) {
        session.kill();
        sessions.delete(message.payload.sessionId);
      }
      return;
    }
  }
}

function spawnLocalPty(cwd: string) {
  const validCwd = existsSync(cwd) ? cwd : process.cwd();
  const shellCandidates = Array.from(
    new Set([os.userInfo().shell, process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"].filter(Boolean) as string[])
  );
  const env = sanitizeEnv({
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    TERM_PROGRAM: "SpaceCode"
  });

  let lastError: unknown;

  for (const shell of shellCandidates) {
    if (!existsSync(shell)) {
      continue;
    }

    try {
      return pty.spawn(shell, ["-l"], {
        name: "xterm-256color",
        cols: 120,
        rows: 32,
        cwd: validCwd,
        env
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? new Error(`Unable to start local shell: ${lastError.message}`)
    : new Error("Unable to start local shell");
}

function spawnRemotePty(project: ProjectRecord, cwd: string) {
  const target = getSshTarget(project);
  if (!target) {
    throw new Error("Remote project is missing SSH target");
  }

  return pty.spawn(
    "ssh",
    ["-t", target, `cd ${quoteRemotePath(cwd)} && exec $SHELL -l || exec /bin/bash -l`],
    {
      name: "xterm-256color",
      cols: 120,
      rows: 32,
      env: sanitizeEnv({
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        TERM_PROGRAM: "SpaceCode"
      })
    }
  );
}

function getSshTarget(project: ProjectRecord) {
  if (project.sshProfile) {
    return project.sshProfile;
  }
  return project.host;
}

function quoteShell(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function quoteRemotePath(value: string) {
  if (value === "~") {
    return "~";
  }

  if (value.startsWith("~/")) {
    const remainder = value.slice(2);
    if (!remainder) {
      return "~/";
    }

    return `~/${remainder
      .split("/")
      .filter(Boolean)
      .map((segment) => quoteShell(segment))
      .join("/")}`;
  }

  return quoteShell(value);
}

function sanitizeEnv(source: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function send(message: HostResponse) {
  if (process.send) {
    process.send(message);
  }
}
