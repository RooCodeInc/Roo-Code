import { render } from "@testing-library/react";
import { TerminalOutput } from "../TerminalOutput";

describe("TerminalOutput", () => {
    it("renders plain text without ANSI codes", () => {
        const { container } = render(<TerminalOutput content="hello world" />);
        expect(container.textContent).toBe("hello world");
    });

    it("converts ANSI color codes to styled spans", () => {
        const { container } = render(
            <TerminalOutput content={"\x1B[32mgreen\x1B[0m"} />
        );
        const span = container.querySelector("span");
        expect(span).toBeTruthy();
        expect(span?.textContent).toBe("green");
    });

    it("escapes HTML in terminal output to prevent XSS", () => {
        const { container } = render(
            <TerminalOutput content={'<script>alert("xss")</script>'} />
        );
        expect(container.innerHTML).not.toContain("<script>");
        expect(container.textContent).toContain('<script>alert("xss")</script>');
    });

    it("handles empty content", () => {
        const { container } = render(<TerminalOutput content="" />);
        expect(container.textContent).toBe("");
    });
});
