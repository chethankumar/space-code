import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import {
  CodeBootstrap,
  CodeMessage,
  CodeModelOption,
  CodePendingRequest,
  CodeReasoningEffort,
  CodeSessionEvent,
  CodeSessionStartInput,
  CodeSessionStatus,
  CodeTokenUsage,
  CodeTurnInput
} from "../shared/types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type PendingApproval = {
  requestId: string;
  jsonRpcId: string | number;
  kind: CodePendingRequest["kind"];
};

type SessionContext = {
  sessionId: string;
  child: ChildProcessWithoutNullStreams;
  output: readline.Interface;
  pending: Map<string, PendingRequest>;
  pendingApprovals: Map<string, PendingApproval>;
  nextRequestId: number;
  threadId?: string;
  cwd: string;
  status: CodeSessionStatus;
  activeTurns: Map<string, { startedAt?: string }>;
};

const REQUEST_TIMEOUT_MS = 60_000;
const ANSI_ESCAPE_CHAR = String.fromCharCode(27);
const ANSI_ESCAPE_REGEX = new RegExp(`${ANSI_ESCAPE_CHAR}\\[[0-9;]*m`, "g");
const BENIGN_STDERR_SNIPPETS = [
  "shell_snapshot",
  "No such file or directory"
];

const DEFAULT_MODE_DEVELOPER_INSTRUCTIONS = `<collaboration_mode># Collaboration Mode: Default

You are now in Default mode. Any previous instructions for other modes (e.g. Plan mode) are no longer active.

Your active mode changes only when new developer instructions with a different \`<collaboration_mode>...</collaboration_mode>\` change it; user requests or tone do not change it.
</collaboration_mode>`;

const PLAN_MODE_DEVELOPER_INSTRUCTIONS = `<collaboration_mode># Plan Mode

Focus on producing a decision-complete implementation plan before execution. Explore first, ask targeted questions only when needed, and present a final plan in a \`<proposed_plan>\` block when ready.
</collaboration_mode>`;

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function parseJsonLine(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return asObject(parsed) ?? null;
  } catch {
    return null;
  }
}

function mapRuntimeMode(runtimeMode: CodeSessionStartInput["runtimeMode"]) {
  if (runtimeMode === "approval-required") {
    return {
      approvalPolicy: "on-request" as const,
      sandbox: "workspace-write" as const
    };
  }

  return {
    approvalPolicy: "never" as const,
    sandbox: "danger-full-access" as const
  };
}

function mapInteractionMode(
  interactionMode: CodeSessionStartInput["interactionMode"],
  model: string | undefined,
  effort: CodeReasoningEffort
) {
  return {
    mode: interactionMode,
    settings: {
      model: model ?? "gpt-5.4",
      reasoning_effort: effort,
      developer_instructions:
        interactionMode === "plan"
          ? PLAN_MODE_DEVELOPER_INSTRUCTIONS
          : DEFAULT_MODE_DEVELOPER_INSTRUCTIONS
    }
  };
}

function toCodeTokenUsage(value: unknown): CodeTokenUsage | undefined {
  const tokenUsage = asObject(value);
  const total = asObject(tokenUsage?.total ?? tokenUsage?.last);
  if (!total) {
    return undefined;
  }

  const totalTokens = Number(total.totalTokens ?? 0);
  const inputTokens = Number(total.inputTokens ?? 0);
  const cachedInputTokens = Number(total.cachedInputTokens ?? 0);
  const outputTokens = Number(total.outputTokens ?? 0);
  const reasoningOutputTokens = Number(total.reasoningOutputTokens ?? 0);
  const modelContextWindow = Number(tokenUsage?.modelContextWindow ?? 0);

  return {
    totalTokens,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    ...(modelContextWindow > 0 ? { modelContextWindow } : {})
  };
}

function toCodeModelOptions(value: unknown): CodeModelOption[] {
  const root = asObject(value);
  const data = asArray(root?.data);
  if (!data) {
    return [];
  }

  return data.flatMap((entry) => {
    const model = asObject(entry);
    const id = asString(model?.id);
    const canonicalModel = asString(model?.model);
    const displayName = asString(model?.displayName);
    const description = asString(model?.description);
    if (!id || !canonicalModel || !displayName || !description) {
      return [];
    }

    const supportedReasoningEfforts = (asArray(model?.supportedReasoningEfforts) ?? [])
      .map((effortEntry) => asObject(effortEntry))
      .map((effortEntry) => asString(effortEntry?.reasoningEffort))
      .filter(
        (effort): effort is CodeReasoningEffort =>
          effort === "low" || effort === "medium" || effort === "high" || effort === "xhigh"
      );

    const inputModalities = (asArray(model?.inputModalities) ?? []).filter(
      (modality): modality is "text" | "image" => modality === "text" || modality === "image"
    );

    const defaultReasoningEffort = asString(model?.defaultReasoningEffort);

    return [
      {
        id,
        model: canonicalModel,
        displayName,
        description,
        supportedReasoningEfforts:
          supportedReasoningEfforts.length > 0 ? supportedReasoningEfforts : ["medium"],
        defaultReasoningEffort:
          defaultReasoningEffort === "low" ||
          defaultReasoningEffort === "medium" ||
          defaultReasoningEffort === "high" ||
          defaultReasoningEffort === "xhigh"
            ? defaultReasoningEffort
            : "medium",
        inputModalities: inputModalities.length > 0 ? inputModalities : ["text"],
        supportsPersonality: Boolean(model?.supportsPersonality),
        isDefault: Boolean(model?.isDefault),
        upgrade: asString(model?.upgrade) ?? null
      }
    ];
  });
}

function createBootstrapFromResponses(accountResponse: unknown, modelResponse: unknown): CodeBootstrap {
  const accountRoot = asObject(accountResponse);
  const account = asObject(accountRoot?.account) ?? accountRoot;
  return {
    account: {
      type:
        asString(account?.type) === "chatgpt"
          ? "chatgpt"
          : asString(account?.type) === "apiKey"
            ? "apiKey"
            : "unknown",
      email: asString(account?.email),
      planType: asString(account?.planType) ?? null,
      requiresOpenaiAuth: Boolean(accountRoot?.requiresOpenaiAuth)
    },
    models: toCodeModelOptions(modelResponse)
  };
}

function createMessageFromItem(
  item: Record<string, unknown>,
  fallbackText = "",
  ...timestampSources: Array<unknown>
): CodeMessage | null {
  const itemType = asString(item.type);
  const id = asString(item.id);
  if (!itemType || !id) {
    return null;
  }

  const createdAt = getCodexTimestamp(item, ...timestampSources);

  if (itemType === "userMessage") {
    const content = asArray(item.content) ?? [];
    const text = content
      .map((entry) => asObject(entry))
      .map((entry) => asString(entry?.text))
      .filter((value): value is string => Boolean(value))
      .join("\n")
      .trim();

    return {
      id,
      kind: "user",
      text,
      ...(createdAt ? { createdAt } : {})
    };
  }

  if (itemType === "agentMessage") {
    return {
      id,
      kind: "assistant",
      text: asString(item.text) ?? fallbackText,
      streaming: true,
      ...(createdAt ? { createdAt } : {})
    };
  }

  if (itemType === "reasoning") {
    return {
      id,
      kind: "reasoning",
      title: "Reasoning",
      text: asString(item.text) ?? fallbackText,
      streaming: true,
      ...(createdAt ? { createdAt } : {})
    };
  }

  const detail =
    asString(item.command) ??
    asString(item.summary) ??
    asString(item.path) ??
    asString(item.text) ??
    fallbackText;

  return {
    id,
    kind: "tool",
    title: itemType.replace(/([a-z])([A-Z])/g, "$1 $2"),
    text: detail,
    ...(createdAt ? { createdAt } : {})
  };
}

function getCodexTimestamp(...sources: Array<unknown>) {
  const candidates = sources.flatMap((source) => {
    const object = asObject(source);
    if (!object) {
      return [];
    }

    return [
      asString(object.createdAt),
      asString(object.created_at),
      asString(object.timestamp),
      asString(object.time),
      asString(asObject(object.event)?.createdAt),
      asString(asObject(object.event)?.created_at),
      asString(asObject(object.thread)?.createdAt),
      asString(asObject(object.thread)?.created_at),
      asString(asObject(object.turn)?.createdAt),
      asString(asObject(object.turn)?.created_at),
      asString(asObject(object.item)?.createdAt),
      asString(asObject(object.item)?.created_at)
    ];
  });

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return candidate;
    }
  }

  return undefined;
}

function mapGitStatus(code: string): "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked" | "unknown" {
  if (code.includes("?")) return "untracked";
  if (code.includes("A")) return "added";
  if (code.includes("M")) return "modified";
  if (code.includes("D")) return "deleted";
  if (code.includes("R")) return "renamed";
  if (code.includes("C")) return "copied";
  return "unknown";
}

async function collectChangedFiles(cwd: string) {
  return await new Promise<
    Array<{
      path: string;
      status: "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked" | "unknown";
    }>
  >((resolve) => {
    const child = spawn("git", ["status", "--short"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        resolve([]);
        return;
      }
      const changedFiles = output
        .split("\n")
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .map((line) => {
          const statusCode = line.slice(0, 2).trim();
          const rawPath = line.slice(3).trim();
          const path = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1)?.trim() ?? rawPath : rawPath;
          return {
            path,
            status: mapGitStatus(statusCode)
          };
        });
      resolve(changedFiles);
    });
    child.on("error", () => resolve([]));
  });
}

async function attachmentToDataUrl(attachment: NonNullable<CodeTurnInput["attachments"]>[number]) {
  if (attachment.dataUrl) {
    return attachment.dataUrl;
  }
  const bytes = await fs.readFile(attachment.path);
  const mimeType = attachment.mimeType ?? "image/png";
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export class CodexHost extends EventEmitter {
  private sessions = new Map<string, SessionContext>();

  async getBootstrap(cwd: string): Promise<CodeBootstrap> {
    const child = spawn("codex", ["app-server"], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const output = readline.createInterface({ input: child.stdout });
    const pending = new Map<string, PendingRequest>();
    let nextRequestId = 1;

    const writeMessage = (message: Record<string, unknown>) => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    const sendRequest = (method: string, params: Record<string, unknown>) => {
      const id = String(nextRequestId++);
      writeMessage({ id, method, params });
      return new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for ${method}`));
        }, REQUEST_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timeout });
      });
    };

    const cleanup = () => {
      for (const request of pending.values()) {
        clearTimeout(request.timeout);
        request.reject(new Error("Bootstrap process closed."));
      }
      pending.clear();
      output.close();
      if (!child.killed) {
        child.kill();
      }
    };

    output.on("line", (line) => {
      const message = parseJsonLine(line);
      if (!message) {
        return;
      }
      const id = asString(message.id) ?? (typeof message.id === "number" ? String(message.id) : undefined);
      if (!id) {
        return;
      }
      const request = pending.get(id);
      if (!request) {
        return;
      }
      pending.delete(id);
      clearTimeout(request.timeout);
      if (message.error) {
        request.reject(new Error(asString(asObject(message.error)?.message) ?? "Codex bootstrap failed"));
        return;
      }
      request.resolve(message.result);
    });

    child.stderr.on("data", () => {
      // bootstrap stderr is noisy; ignore unless requests time out
    });

    try {
      const initialize = {
        clientInfo: {
          name: "spacecode_desktop",
          title: "SpaceCode",
          version: "0.1.0"
        },
        capabilities: {
          experimentalApi: true
        }
      };

      writeMessage({ id: String(nextRequestId++), method: "initialize", params: initialize });
      const initializeId = String(nextRequestId - 1);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for initialize")), REQUEST_TIMEOUT_MS);
        pending.set(initializeId, {
          resolve: () => {
            clearTimeout(timeout);
            resolve();
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout
        });
      });
      writeMessage({ method: "initialized" });

      const [accountResponse, modelResponse] = await Promise.all([
        sendRequest("account/read", {}),
        sendRequest("model/list", {})
      ]);

      cleanup();
      return createBootstrapFromResponses(accountResponse, modelResponse);
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  async startSession(input: CodeSessionStartInput): Promise<void> {
    if (this.sessions.has(input.sessionId)) {
      return;
    }

    const child = spawn("codex", ["app-server"], {
      cwd: input.cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const output = readline.createInterface({ input: child.stdout });
    const context: SessionContext = {
      sessionId: input.sessionId,
      child,
      output,
      pending: new Map(),
      pendingApprovals: new Map(),
      nextRequestId: 1,
      cwd: input.cwd,
      status: "connecting",
      activeTurns: new Map()
    };

    this.sessions.set(input.sessionId, context);
    this.attachProcessListeners(context);
    this.emitCodeEvent({
      type: "session.state",
      sessionId: input.sessionId,
      status: "connecting",
      message: "Starting Codex…"
    });

    try {
      await this.sendRequest(context, "initialize", {
        clientInfo: {
          name: "spacecode_desktop",
          title: "SpaceCode",
          version: "0.1.0"
        },
        capabilities: {
          experimentalApi: true
        }
      });
      this.writeMessage(context, { method: "initialized" });

      const [accountResponse, modelResponse] = await Promise.all([
        this.sendRequest(context, "account/read", {}),
        this.sendRequest(context, "model/list", {})
      ]);

      const bootstrap = createBootstrapFromResponses(accountResponse, modelResponse);
      const sessionOverrides = {
        model: input.model ?? null,
        cwd: input.cwd,
        ...mapRuntimeMode(input.runtimeMode)
      };

      const threadMethod = input.resumeThreadId ? "thread/resume" : "thread/start";
      const threadResponse = await this.sendRequest(
        context,
        threadMethod,
        input.resumeThreadId
          ? { ...sessionOverrides, threadId: input.resumeThreadId }
          : { ...sessionOverrides, experimentalRawEvents: false }
      );

      const threadRoot = asObject(threadResponse);
      const thread = asObject(threadRoot?.thread);
      const threadId = asString(thread?.id) ?? asString(threadRoot?.threadId);
      if (!threadId) {
        throw new Error(`${threadMethod} did not return a thread id.`);
      }

      context.threadId = threadId;
      context.status = "ready";

      this.emitCodeEvent({
        type: "session.started",
        sessionId: input.sessionId,
        threadId,
        title: asString(thread?.title),
        cwd: input.cwd,
        sessionPath: asString(thread?.path),
        account: bootstrap.account,
        models: bootstrap.models,
        status: "ready"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start Codex session.";
      context.status = "error";
      this.emitCodeEvent({
        type: "error",
        sessionId: input.sessionId,
        message
      });
      this.stopSession(input.sessionId);
      throw error;
    }
  }

  async sendTurn(input: CodeTurnInput): Promise<void> {
    const context = this.requireSession(input.sessionId);
    if (!context.threadId) {
      throw new Error("Code session is missing a thread id.");
    }

    const turnInput: Array<{ type: "text"; text: string; text_elements: [] } | { type: "image"; url: string }> = [];
    const text = input.input?.trim();
    if (text) {
      turnInput.push({
        type: "text",
        text,
        text_elements: []
      });
    }

    for (const attachment of input.attachments ?? []) {
      turnInput.push({
        type: "image",
        url: await attachmentToDataUrl(attachment)
      });
    }

    if (turnInput.length === 0) {
      throw new Error("Turn input must include text or an image attachment.");
    }

    context.status = "running";
    this.emitCodeEvent({
      type: "session.state",
      sessionId: input.sessionId,
      status: "running"
    });

    await this.sendRequest(context, "turn/start", {
      threadId: context.threadId,
      input: turnInput,
      ...(input.model ? { model: input.model } : {}),
      ...(input.reasoningEffort ? { effort: input.reasoningEffort } : {}),
      collaborationMode: mapInteractionMode(
        input.interactionMode ?? "default",
        input.model,
        input.reasoningEffort ?? "medium"
      )
    });
  }

  async interruptTurn(sessionId: string, turnId?: string): Promise<void> {
    const context = this.requireSession(sessionId);
    if (!context.threadId) {
      return;
    }
    await this.sendRequest(context, "turn/interrupt", {
      threadId: context.threadId,
      ...(turnId ? { turnId } : {})
    });
  }

  async respondToRequest(
    sessionId: string,
    requestId: string,
    decision: "approved" | "denied",
    answers?: Record<string, string | string[]>
  ): Promise<void> {
    const context = this.requireSession(sessionId);
    const pending = context.pendingApprovals.get(requestId);
    if (!pending) {
      throw new Error(`Unknown pending request: ${requestId}`);
    }

    context.pendingApprovals.delete(requestId);
    if (pending.kind === "user-input") {
      const normalizedAnswers = Object.fromEntries(
        Object.entries(answers ?? {}).map(([questionId, value]) => [
          questionId,
          { answers: Array.isArray(value) ? value : [value] }
        ])
      );
      this.writeMessage(context, {
        id: pending.jsonRpcId,
        result: {
          answers: normalizedAnswers
        }
      });
    } else {
      this.writeMessage(context, {
        id: pending.jsonRpcId,
        result: {
          decision
        }
      });
    }

    this.emitCodeEvent({
      type: "request.resolved",
      sessionId,
      requestId
    });
  }

  stopSession(sessionId: string): void {
    const context = this.sessions.get(sessionId);
    if (!context) {
      return;
    }

    for (const request of context.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error("Session stopped."));
    }
    context.pending.clear();
    context.pendingApprovals.clear();
    context.output.close();
    if (!context.child.killed) {
      context.child.kill();
    }
    this.sessions.delete(sessionId);
    this.emitCodeEvent({
      type: "session.state",
      sessionId,
      status: "closed"
    });
  }

  private requireSession(sessionId: string) {
    const context = this.sessions.get(sessionId);
    if (!context) {
      throw new Error(`Unknown code session: ${sessionId}`);
    }
    return context;
  }

  private attachProcessListeners(context: SessionContext) {
    context.output.on("line", (line) => {
      this.handleStdoutLine(context, line);
    });

    context.child.stderr.on("data", (chunk: Buffer) => {
      const line = chunk.toString().replaceAll(ANSI_ESCAPE_REGEX, "").trim();
      if (!line || BENIGN_STDERR_SNIPPETS.some((snippet) => line.includes(snippet))) {
        return;
      }

      this.emitCodeEvent({
        type: "error",
        sessionId: context.sessionId,
        message: line
      });
    });

    context.child.on("exit", () => {
      if (!this.sessions.has(context.sessionId)) {
        return;
      }
      this.sessions.delete(context.sessionId);
      this.emitCodeEvent({
        type: "session.state",
        sessionId: context.sessionId,
        status: "closed"
      });
    });
  }

  private handleStdoutLine(context: SessionContext, line: string) {
    const message = parseJsonLine(line);
    if (!message) {
      return;
    }

    const responseId =
      asString(message.id) ?? (typeof message.id === "number" ? String(message.id) : undefined);
    if (responseId) {
      const request = context.pending.get(responseId);
      if (!request) {
        return;
      }
      context.pending.delete(responseId);
      clearTimeout(request.timeout);

      if (message.error) {
        request.reject(
          new Error(asString(asObject(message.error)?.message) ?? "Codex request failed.")
        );
      } else {
        request.resolve(message.result);
      }
      return;
    }

    const method = asString(message.method);
    const params = asObject(message.params);
    if (!method) {
      return;
    }

    const receivedAt = new Date().toISOString();

    if ("id" in message) {
      this.handleProviderRequest(context, method, message.id as string | number, params, receivedAt);
      return;
    }

    this.handleNotification(context, method, params, message, receivedAt);
  }

  private handleProviderRequest(
    context: SessionContext,
    method: string,
    jsonRpcId: string | number,
    params: Record<string, unknown> | undefined,
    receivedAt: string
  ) {
    const requestId = asString(params?.requestId) ?? `${jsonRpcId}`;
    let request: CodePendingRequest | null = null;

    if (method === "item/commandExecution/requestApproval") {
      request = {
        requestId,
        kind: "command",
        title: "Command approval requested",
        detail: asString(params?.command) ?? asString(params?.reason),
        command: asString(params?.command)
      };
    } else if (method === "item/fileRead/requestApproval") {
      request = {
        requestId,
        kind: "file-read",
        title: "File read approval requested",
        detail: asString(params?.reason) ?? asString(params?.path)
      };
    } else if (method === "item/fileChange/requestApproval") {
      request = {
        requestId,
        kind: "file-change",
        title: "File change approval requested",
        detail: asString(params?.reason) ?? asString(params?.path)
      };
    } else if (method === "item/tool/requestUserInput") {
      const questions = (asArray(params?.questions) ?? [])
        .map((entry) => asObject(entry))
        .flatMap((entry) => {
          const id = asString(entry?.id);
          const header = asString(entry?.header);
          const question = asString(entry?.question);
          const options = (asArray(entry?.options) ?? [])
            .map((option) => asObject(option))
            .flatMap((option) => {
              const label = asString(option?.label);
              const description = asString(option?.description);
              return label && description ? [{ label, description }] : [];
            });
          return id && header && question && options.length > 0
            ? [{ id, header, question, options }]
            : [];
        });

      request = {
        requestId,
        kind: "user-input",
        title: "Codex needs input",
        questions
      };
    }

    if (!request) {
      return;
    }

    context.pendingApprovals.set(requestId, {
      requestId,
      jsonRpcId,
      kind: request.kind
    });

    this.emitCodeEvent({
      type: "request.opened",
      sessionId: context.sessionId,
      request
    });
  }

  private handleNotification(
    context: SessionContext,
    method: string,
    params: Record<string, unknown> | undefined,
    rawMessage?: Record<string, unknown>,
    receivedAt?: string
  ) {
    if (method === "thread/status/changed") {
      const statusType = asString(asObject(params?.status)?.type);
      const status: CodeSessionStatus =
        statusType === "active"
          ? "running"
          : statusType === "idle"
            ? "ready"
            : statusType === "error"
              ? "error"
              : context.status;
      context.status = status;
      this.emitCodeEvent({
        type: "session.state",
        sessionId: context.sessionId,
        status
      });
      return;
    }

    if (method === "turn/started") {
      const turn = asObject(params?.turn);
      const turnId = asString(turn?.id);
      if (turnId) {
        const startedAt = getCodexTimestamp(rawMessage, turn, params) ?? receivedAt;
        context.activeTurns.set(turnId, { ...(startedAt ? { startedAt } : {}) });
        this.emitCodeEvent({
          type: "turn.started",
          sessionId: context.sessionId,
          turnId
        });
      }
      return;
    }

    if (method === "turn/completed") {
      const turn = asObject(params?.turn);
      const turnId = asString(turn?.id);
      if (turnId) {
        const completedAt = getCodexTimestamp(rawMessage, turn, params) ?? receivedAt;
        const startedTurn = context.activeTurns.get(turnId);
        context.activeTurns.delete(turnId);
        void collectChangedFiles(context.cwd).then((changedFiles) => {
          this.emitCodeEvent({
            type: "turn.completed",
            sessionId: context.sessionId,
            turnId,
            status:
              asString(turn?.status) === "failed"
                ? "failed"
                : asString(turn?.status) === "cancelled"
                  ? "cancelled"
                  : asString(turn?.status) === "interrupted"
                    ? "interrupted"
                    : "completed",
            error: asString(turn?.error),
            ...(completedAt ? { completedAt } : {}),
            ...(completedAt && startedTurn?.startedAt
              ? {
                  elapsedMs:
                    new Date(completedAt).getTime() - new Date(startedTurn.startedAt).getTime()
                }
              : {}),
            ...(changedFiles.length > 0 ? { changedFiles } : {})
          });
        });
      }
      context.status = "ready";
      this.emitCodeEvent({
        type: "session.state",
        sessionId: context.sessionId,
        status: "ready"
      });
      return;
    }

    if (method === "thread/compacted") {
      this.emitCodeEvent({
        type: "thread.compacted",
        sessionId: context.sessionId,
        at: getCodexTimestamp(rawMessage, params) ?? receivedAt,
        summary: asString(params?.summary)
      });
      return;
    }

    if (method === "thread/tokenUsage/updated") {
      const usage = toCodeTokenUsage(params?.tokenUsage);
      if (usage) {
        this.emitCodeEvent({
          type: "token-usage.updated",
          sessionId: context.sessionId,
          usage
        });
      }
      return;
    }

    if (method === "item/agentMessage/delta" || method === "item/reasoning/textDelta" || method === "item/reasoning/summaryTextDelta") {
      const itemId = asString(params?.itemId);
      const delta = asString(params?.delta);
      if (itemId && delta) {
        this.emitCodeEvent({
          type: "message.delta",
          sessionId: context.sessionId,
          messageId: itemId,
          delta
        });
      }
      return;
    }

    if (method === "item/started") {
      const item = asObject(params?.item);
      const message = item
        ? createMessageFromItem(item, "", { createdAt: receivedAt }, rawMessage, params)
        : null;
      if (message) {
        this.emitCodeEvent({
          type: "message.started",
          sessionId: context.sessionId,
          message
        });
      }
      return;
    }

    if (method === "item/completed") {
      const item = asObject(params?.item);
      const itemId = asString(item?.id);
      if (!itemId) {
        return;
      }
      this.emitCodeEvent({
        type: "message.completed",
        sessionId: context.sessionId,
        messageId: itemId,
        text: asString(item?.text)
      });
    }
  }

  private sendRequest(context: SessionContext, method: string, params: Record<string, unknown>) {
    const id = String(context.nextRequestId++);
    this.writeMessage(context, { id, method, params });

    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        context.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, REQUEST_TIMEOUT_MS);

      context.pending.set(id, {
        resolve,
        reject,
        timeout
      });
    });
  }

  private writeMessage(context: SessionContext, message: Record<string, unknown>) {
    context.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private emitCodeEvent(event: CodeSessionEvent) {
    this.emit("event", event);
  }
}
