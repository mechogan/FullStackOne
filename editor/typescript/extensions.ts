import { EditorView } from "@codemirror/view";
import { WorkerTS } from ".";
import { CompletionContext } from "@codemirror/autocomplete";
import type ts from "typescript";
import { Diagnostic } from "@codemirror/lint";
import { codeEditor } from "../code-editor";
import fs from "../../lib/fs";


export const tsErrorLinter = (workingDirectory: string, filePath: string) => async (view: EditorView) => {
    await WorkerTS.start(workingDirectory);
    await WorkerTS.call().updateFile(filePath, view.state.doc.toString());

    const getAllTsError = async () => {
        const tsErrors = await Promise.all([
            WorkerTS.call().getSemanticDiagnostics(filePath),
            WorkerTS.call().getSyntacticDiagnostics(filePath),
            WorkerTS.call().getSuggestionDiagnostics(filePath)
        ]);

        return tsErrors.flat();
    };

    const tsErrors = await getAllTsError();

    return tsErrors
        .filter((tsError) => !!tsError)
        .map((tsError) => {
            return {
                from: tsError.start,
                to: tsError.start + tsError.length,
                severity: tsError.code === 7016 ? "warning" : "error",
                message: messageChainToArr(tsError.messageText).join("\n\n")
            } as Diagnostic;
        });
};

function messageChainToArr(
    messageChain: ts.Diagnostic["messageText"]
): string[] {
    if (!messageChain) {
        return [];
    } else if (typeof messageChain === "string") {
        return [messageChain];
    }

    const nextMessages = messageChain.next?.map(messageChainToArr)?.flat();
    return [messageChain.messageText, ...(nextMessages || [])];
}

export const tsAutocomplete =
    (filePath: string) => async (ctx: CompletionContext) => {
        const text = ctx.state.doc.toString();
        await WorkerTS.call().updateFile(
            filePath,
            ctx.view.state.doc.toString()
        );

        let tsCompletions = await WorkerTS.call().getCompletionsAtPosition(
            filePath,
            ctx.pos,
            {
                allowIncompleteCompletions: true,
                allowRenameOfImportPath: true,
                includeCompletionsForImportStatements: true,
                includeCompletionsForModuleExports: true
            }
        );

        if (!tsCompletions) return { from: ctx.pos, options: [] };

        let lastWord, from;
        for (let i = ctx.pos - 1; i >= 0; i--) {
            if (
                [
                    " ",
                    ".",
                    "\n",
                    ":",
                    "{",
                    "<",
                    '"',
                    "'",
                    "(",
                    "[",
                    "!"
                ].includes(text[i]) ||
                i === 0
            ) {
                from = i === 0 ? i : i + 1;
                lastWord = text.slice(from, ctx.pos).trim();
                break;
            }
        }

        if (lastWord) {
            tsCompletions.entries = tsCompletions.entries.filter((completion) =>
                completion.name.startsWith(lastWord)
            );
        }

        return {
            from: ctx.pos,
            options: tsCompletions.entries.map((completion) => ({
                label: completion.name,
                apply: (view: EditorView) => {
                    WorkerTS.call()
                        .getCompletionEntryDetails(
                            filePath,
                            ctx.pos,
                            completion.name,
                            {},
                            completion.source,
                            {
                                allowIncompleteCompletions: true,
                                allowRenameOfImportPath: true,
                                includeCompletionsForImportStatements: true,
                                includeCompletionsForModuleExports: true
                            },
                            completion.data
                        )
                        .then((details) => {
                            if (!details?.codeActions?.length) return;

                            view.dispatch({
                                changes: details.codeActions
                                    .at(0)
                                    .changes.map(({ textChanges }) =>
                                        textChanges.map((change) => ({
                                            from: change.span.start,
                                            to:
                                                change.span.start +
                                                change.span.length,
                                            insert: change.newText
                                        }))
                                    )
                                    .flat()
                            });
                        });

                    view.dispatch({
                        changes: {
                            from,
                            to: ctx.pos,
                            insert: completion.name
                        }
                    });
                    if (from === ctx.pos) {
                        view.dispatch({
                            selection: {
                                anchor: from + completion.name.length,
                                head: from + completion.name.length
                            }
                        });
                    }
                }
            }))
        };
    };

export const tsTypeDefinition =
    (filePath: string) => async (view: EditorView, pos: number, side) => {
        const info = await WorkerTS.call().getQuickInfoAtPosition(
            filePath,
            pos
        );
        const text = info?.displayParts?.map(({ text }) => text).join("");

        if (!text) return null;

        return {
            pos: info.textSpan.start,
            end: info.textSpan.start + info.textSpan.length,
            above: true,
            create: () => {
                let dom = document.createElement("div");
                const pre = document.createElement("pre");
                pre.innerText = text;
                dom.append(pre);
                return { dom };
            }
        };
    };

export const navigateToDefinition =
    (filePath: string) => (e: MouseEvent, view: EditorView) => {
        if (!e.metaKey && !e.ctrlKey) return null;

        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });

        if (!pos) return;

        WorkerTS.call()
            .getDefinitionAtPosition(filePath, pos)
            .then(async (defs) => {
                if (!defs?.length) return;

                const def = defs.at(0);
                if (!def) return;

                const filename = def.fileName;
                const pos = def.textSpan.start;

                const workspace = codeEditor.getWorkspace();

                if (!workspace.file.isOpen(filename)) {
                    await workspace.file.open(filename, fs.readFile(filename));
                }

                workspace.file.goTo(filename, pos)
            });
    };
