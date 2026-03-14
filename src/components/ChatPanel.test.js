// client/src/tests/ChatPanel.test.jsx
// Run: cd client && npx jest src/tests/ChatPanel.test.jsx
//
// Prerequisites:
//   npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ChatPanel from "../components/ChatPanel";

// scrollIntoView is not implemented in jsdom
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeMsg = (i, userId = "user1") => ({
  id: `msg-${i}`,
  message: `Message ${i}`,
  userName: userId === "user1" ? "Alice" : "Bob",
  userId,
  timestamp: new Date(Date.now() - (100 - i) * 1000).toISOString(),
});

const baseProps = {
  messages: [],
  userId: "user1",
  onSend: jest.fn(),
  onClose: jest.fn(),
};

// ── Rendering ─────────────────────────────────────────────────────────────────
describe("ChatPanel — rendering", () => {
  test("shows empty state when no messages", () => {
    render(<ChatPanel {...baseProps} />);
    expect(screen.getByText(/Start the conversation/i)).toBeInTheDocument();
  });

  test("renders all message bubbles", () => {
    const messages = [makeMsg(0), makeMsg(1), makeMsg(2)];
    render(<ChatPanel {...baseProps} messages={messages} />);
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.getByText("Message 1")).toBeInTheDocument();
    expect(screen.getByText("Message 2")).toBeInTheDocument();
  });

  test("shows sender name for messages from other users", () => {
    const messages = [makeMsg(0, "user2")];
    render(<ChatPanel {...baseProps} messages={messages} />);
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  test("does NOT show sender name for own messages", () => {
    const messages = [makeMsg(0, "user1")];
    render(<ChatPanel {...baseProps} messages={messages} />);
    // Alice is the local user — her name should not appear as a label
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  test("groups consecutive messages from same user (name appears once)", () => {
    const messages = [
      makeMsg(0, "user2"),
      makeMsg(1, "user2"),
      makeMsg(2, "user1"),
    ];
    render(<ChatPanel {...baseProps} messages={messages} />);
    const bobs = screen.getAllByText("Bob");
    expect(bobs).toHaveLength(1);
  });
});

// ── Sending messages ──────────────────────────────────────────────────────────
describe("ChatPanel — sending messages", () => {
  test("calls onSend with trimmed text on Enter", async () => {
    const onSend = jest.fn();
    render(<ChatPanel {...baseProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await userEvent.type(textarea, "Hello world");
    await userEvent.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("Hello world");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  test("does not send empty message on Enter", async () => {
    const onSend = jest.fn();
    render(<ChatPanel {...baseProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await userEvent.click(textarea);
    await userEvent.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  test("does not send on Shift+Enter (newline)", async () => {
    const onSend = jest.fn();
    render(<ChatPanel {...baseProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await userEvent.type(textarea, "line one");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  test("send button is disabled when input is empty", () => {
    render(<ChatPanel {...baseProps} />);
    const sendBtn = screen.getByRole("button", { name: /send message/i });
    expect(sendBtn).toBeDisabled();
  });

  test("send button enables when input has text", async () => {
    render(<ChatPanel {...baseProps} />);
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    const sendBtn = screen.getByRole("button", { name: /send message/i });
    await userEvent.type(textarea, "hi");
    expect(sendBtn).not.toBeDisabled();
  });

  test("clears input after sending", async () => {
    const onSend = jest.fn();
    render(<ChatPanel {...baseProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await userEvent.type(textarea, "test message");
    await userEvent.keyboard("{Enter}");
    expect(textarea).toHaveValue("");
  });

  test("trimmed whitespace-only message is not sent", async () => {
    const onSend = jest.fn();
    render(<ChatPanel {...baseProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await userEvent.type(textarea, "   ");
    await userEvent.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });
});

// ── Unread divider ────────────────────────────────────────────────────────────
describe("ChatPanel — unread divider", () => {
  test("shows unread divider when unreadCount > 0", () => {
    const messages = [
      makeMsg(0, "user2"),
      makeMsg(1, "user2"),
      makeMsg(2, "user2"),
    ];
    render(<ChatPanel {...baseProps} messages={messages} unreadCount={2} />);
    expect(screen.getByText(/Unread messages/i)).toBeInTheDocument();
  });

  test("no unread divider when unreadCount is 0", () => {
    const messages = [makeMsg(0, "user2"), makeMsg(1, "user2")];
    render(<ChatPanel {...baseProps} messages={messages} unreadCount={0} />);
    expect(screen.queryByText(/Unread messages/i)).not.toBeInTheDocument();
  });
});

// ── Close button ──────────────────────────────────────────────────────────────
describe("ChatPanel — close button", () => {
  test("calls onClose when close button is clicked", async () => {
    const onClose = jest.fn();
    render(<ChatPanel {...baseProps} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /close chat/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────
describe("ChatPanel — accessibility", () => {
  test("panel has role=dialog and aria-modal", () => {
    render(<ChatPanel {...baseProps} />);
    const panel = screen.getByRole("dialog", { name: /chat/i });
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("aria-modal", "true");
  });

  test("close button has accessible label", () => {
    render(<ChatPanel {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /close chat/i }),
    ).toBeInTheDocument();
  });

  test("send button has accessible label", () => {
    render(<ChatPanel {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /send message/i }),
    ).toBeInTheDocument();
  });

  test("message input has accessible label", () => {
    render(<ChatPanel {...baseProps} />);
    expect(
      screen.getByRole("textbox", { name: /message input/i }),
    ).toBeInTheDocument();
  });
});
