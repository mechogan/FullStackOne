import { Button, Dialog, InputPredictive } from "@fullstacked/ui";
import { createElement } from "../../components/element";
import { commands } from "../../commands";
import { codeEditor } from "../../code-editor";
import { Chat } from "@fullstacked/code-editor";

let promptDialog = null;
function closeDialog() {
    promptDialog?.remove();
    promptDialog = null;
}

export function openPrompt() {
    if (promptDialog) return;
    promptDialog = Dialog(Prompt());
}

export function InitPrompt() {
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeDialog();
        } else if (
            e.key.toLocaleLowerCase() === "p" &&
            e.shiftKey &&
            (e.ctrlKey || e.metaKey)
        ) {
            e.preventDefault();
            e.stopPropagation();
            openPrompt();
        }
    });
}

function Prompt() {
    const container = createElement("div");
    container.classList.add("prompt-container");

    const inputPredictive = InputPredictive({
        label: "Prompt",
        onChange: async (v) => {
            const words = v.split(" ");
            const lastWord = words.pop();

            const predictionsSeek: (string[] | Promise<string[]>)[] = [];

            if (words.length === 0) {
                predictionsSeek.push(commands.map(({ name }) => name + " "));
            }

            words.reduce((c, w, i) => {
                if (!c) return;

                const cmd = c.find(({ name }) => name === w);

                if (cmd && i === words.length - 1) {
                    if (cmd.subcommand) {
                        predictionsSeek.push(
                            cmd.subcommand.map(({ name }) => name + " ")
                        );
                    }
                    if (cmd.suggestions) {
                        predictionsSeek.push(cmd.suggestions(lastWord));
                    }
                }

                if (cmd?.subcommand) {
                    return cmd.subcommand;
                }

                return null;
            }, commands);

            let predictions = (await Promise.all(predictionsSeek))
                .flat()
                .filter((p) => p?.startsWith?.(lastWord))
                .map((p) => p.slice(lastWord.length));

            if (v === "") {
                predictions?.unshift("");
            }

            return predictions || [""];
        }
    });
    const closeButton = Button({
        text: "Close",
        style: "text"
    });
    closeButton.onclick = closeDialog;

    container.append(inputPredictive.container, closeButton);

    inputPredictive.input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;

        e.preventDefault();

        const value = inputPredictive.getValue();
        const words = value.split(" ");
        const firstWord = words.shift();
        const args = [];
        const command = words.reduce(
            (c, w, i) => {
                if (!c) return undefined;

                const subcommand = c.subcommand?.find(
                    ({ name, alias }) =>
                        name === w || alias.find((a) => a === w)
                );
                if (subcommand) {
                    return subcommand;
                }

                args.push(w);

                return c;
            },
            commands.find(({ name }) => name === firstWord)
        );

        if (!command?.exec?.(args)) {
            const chatView = new Chat();
            codeEditor.getWorkspace().item.add(chatView);
            chatView.prompt(value);
        }

        closeDialog();
    });

    setTimeout(() => inputPredictive.input.focus());
    return container;
}
